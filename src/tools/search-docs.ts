/**
 * Docs Search Tool
 *
 * Search and retrieve relevant content from Clix documentation using
 * the Mintlify-compatible llms.txt endpoint.
 */

import { z } from "zod";
import type { ToolDefinition, ServerContext } from "../types.js";
import { DOCS_SEARCH_MAX_RESULTS, MCP_USER_AGENT, DEFAULT_API_TIMEOUT } from "../constants.js";
import { ApiError } from "../errors.js";
import { BM25 } from "../utils/bm25.js";
import { DOCS_SEARCH_DESCRIPTION } from "./descriptions.js";

const docsSearchInputSchema = z.object({
  query: z
    .string()
    .min(2, "Search query must be at least 2 characters")
    .max(200, "Search query must be less than 200 characters")
    .describe("The search query to find relevant documentation"),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DOCS_SEARCH_MAX_RESULTS)
    .optional()
    .describe("Maximum number of results to return (1-10)"),
});

type DocsSearchInput = z.infer<typeof docsSearchInputSchema>;

interface DocsLink {
  title: string;
  url: string;
  description?: string;
}

/**
 * Parse llms.txt format from Mintlify
 * Format: - [Title](URL): Description
 */
function parseLlmsTxt(content: string): DocsLink[] {
  const links: DocsLink[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match format: - [Title](URL): Description
    const match = line.match(/^-\s*\[(.*?)\]\((.*?)\)(?::\s*(.*))?$/);
    if (match) {
      const [, title, url, description] = match;
      if (title && url) {
        links.push({
          title: title.trim(),
          url: url.trim(),
          description: description?.trim(),
        });
      }
    }
  }

  return links;
}

/**
 * Search docs links by query using BM25 algorithm
 * BM25 is the industry-standard ranking function
 */
function searchDocs(links: DocsLink[], query: string, maxResults: number): DocsLink[] {
  // Initialize BM25 with field weights
  // Title matches are more important than description or URL
  const bm25 = new BM25({
    k1: 1.5, // Term frequency saturation
    b: 0.75, // Document length normalization
    fieldWeights: {
      title: 3.0, // Title is most important
      description: 1.5, // Description is moderately important
      url: 0.8, // URL is least important
    },
  });

  // Convert docs to BM25 document format
  const documents = links.map((link, index) => ({
    id: index.toString(),
    fields: {
      title: link.title || "",
      description: link.description || "",
      url: link.url || "",
    },
  }));

  // Index documents
  bm25.indexDocuments(documents);

  // Search using BM25
  const results = bm25.search(query, maxResults);

  // Map back to DocsLink objects
  return results
    .map((result) => links[parseInt(result.id)])
    .filter((link): link is DocsLink => link !== undefined);
}

/**
 * Fetch content from a documentation URL
 * Mintlify pages can be fetched and parsed for their main content
 */
async function fetchDocContent(url: string): Promise<string> {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": MCP_USER_AGENT,
          Accept: "text/html",
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        // Provide clearer messages for specific status codes
        if (response.status === 429) {
          return `Rate limited (HTTP 429). Please try again later.`;
        }
        if (response.status >= 500) {
          return `Server error (HTTP ${response.status}). Please try again later.`;
        }
        return `Unable to fetch content (HTTP ${response.status})`;
      }

      const html = await response.text();

      // Extract main content from HTML
      // Mintlify uses specific patterns, but we'll do a simple extraction
      // Remove script and style tags
      let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

      // Remove HTML tags
      content = content.replace(/<[^>]+>/g, " ");

      // Decode HTML entities
      content = content
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

      // Clean up whitespace
      content = content.replace(/\s+/g, " ").trim();

      // Limit content length
      const maxLength = 3000;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + "\n\n...(truncated for brevity)";
      }

      return content;
    } catch (fetchError) {
      clearTimeout(timer);
      if ((fetchError as Error).name === "AbortError") {
        return `Request timeout after ${DEFAULT_API_TIMEOUT}ms. Server may be slow or unreachable.`;
      }
      throw fetchError;
    }
  } catch (error) {
    return `Error fetching content: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export const docsSearchTool: ToolDefinition<DocsSearchInput, string> = {
  name: "search_docs",
  description: DOCS_SEARCH_DESCRIPTION,
  inputSchema: {
    query: docsSearchInputSchema.shape.query,
    maxResults: docsSearchInputSchema.shape.maxResults,
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
  async handler(params: DocsSearchInput, _context: ServerContext): Promise<string> {
    try {
      // Fetch llms.txt from Clix docs
      const response = await fetch("https://docs.clix.so/llms.txt");

      if (!response.ok) {
        throw new ApiError(
          `Failed to fetch Clix documentation: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const content = await response.text();
      const allDocs = parseLlmsTxt(content);

      if (allDocs.length === 0) {
        return `[Warning] No Documentation Available\n\nUnable to parse Clix documentation. Please try again later.`;
      }

      // Search docs
      const results = searchDocs(
        allDocs,
        params.query,
        params.maxResults || DOCS_SEARCH_MAX_RESULTS
      );

      if (results.length === 0) {
        return `[No Results] No Results Found\n\nQuery: "${params.query}"\n\nNo documentation found matching your query. Try using different keywords or broader search terms.`;
      }

      // Format output with actual content
      let output = `# Clix Documentation Search Results\n\n`;
      output += `**Query**: "${params.query}"\n`;
      output += `**Found**: ${results.length} relevant page${results.length === 1 ? "" : "s"}\n\n`;
      output += `---\n\n`;

      // Fetch content for each result
      for (const [index, doc] of results.entries()) {
        output += `## ${index + 1}. ${doc.title}\n\n`;
        output += `**URL**: ${doc.url}\n\n`;

        if (doc.description) {
          output += `**Description**: ${doc.description}\n\n`;
        }

        // Fetch and include actual content
        output += `**Content**:\n\n`;
        const content = await fetchDocContent(doc.url);
        output += `${content}\n\n`;

        output += `---\n\n`;
      }

      output += `\n**Tip**: For more details, visit the full documentation pages above.`;

      return output;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Documentation search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};

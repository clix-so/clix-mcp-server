/**
 * SDK Search Tool
 *
 * Search and retrieve relevant code snippets from Clix SDK repositories
 * (iOS, Android, Flutter, React Native) using custom sdk_llms.txt format.
 */

import { z } from "zod";
import type { ToolDefinition, ServerContext } from "../types.js";
import { SDK_SEARCH_MAX_RESULTS, MCP_USER_AGENT, DEFAULT_API_TIMEOUT } from "../constants.js";
import { ApiError } from "../errors.js";
import { BM25 } from "../utils/bm25.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SDK_SEARCH_DESCRIPTION } from "./descriptions.js";

const sdkSearchInputSchema = z.object({
  query: z
    .string()
    .min(2, "Search query must be at least 2 characters")
    .max(200, "Search query must be less than 200 characters")
    .describe("The search query to find relevant SDK code and examples"),
  platform: z
    .string()
    .default("all")
    .optional()
    .transform((val) => {
      // Normalize platform names
      if (!val) return "all";
      const normalized = val.toLowerCase().replace(/\s+/g, "-");
      // Map common variations to canonical names
      const platformMap: Record<string, string> = {
        "react-native": "react-native",
        reactnative: "react-native",
        react: "react-native",
        ios: "ios",
        android: "android",
        flutter: "flutter",
        javascript: "javascript",
        js: "javascript",
        "google-tag-manager": "gtm",
        gtm: "gtm",
        "gtm-template": "gtm",
        template: "gtm",
        all: "all",
      };
      return platformMap[normalized] || "all";
    })
    .describe(
      "Filter by SDK platform (ios, android, flutter, react native, javascript, gtm, or all)"
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(SDK_SEARCH_MAX_RESULTS)
    .optional()
    .describe("Maximum number of results to return (1-10)"),
});

type SdkSearchInput = z.infer<typeof sdkSearchInputSchema>;

interface SdkEntry {
  platform: string;
  title: string;
  file: string;
  description?: string;
  snippet?: string;
}

/**
 * Parse SDK llms.txt format
 * Format:
 * # Platform: iOS
 * - [Title](file/path.swift): Description
 */
function canonicalizePlatformHeader(rawHeader: string | undefined): string {
  const header = (rawHeader ?? "").toLowerCase();
  if (/\breact\s*-?\s*native\b/.test(header)) return "react-native";
  if (/\bios\b/.test(header)) return "ios";
  if (/\bandroid\b/.test(header)) return "android";
  if (/\bflutter\b/.test(header)) return "flutter";
  if (/\bjava\s*script\b/.test(header) || /\bjs\b/.test(header)) return "javascript";
  if (/\bgoogle\s+tag\s+manager\b/.test(header) || /\bgtm\b/.test(header)) return "gtm";
  // Fallback: first token without parentheses
  const withoutParen = header.includes("(") ? (header.split("(")[0] ?? "") : header;
  const firstToken = withoutParen.trim().split(/\s+/)[0];
  return firstToken || "unknown";
}

function parseSdkLlmsTxt(content: string): SdkEntry[] {
  const entries: SdkEntry[] = [];
  const lines = content.split("\n");
  let currentPlatform = "unknown";

  for (const line of lines) {
    // Check for platform header: # Platform: iOS / React Native / Flutter / Android
    const platformMatch = line.match(/^#\s*Platform:\s*(.+)$/i);
    if (platformMatch && platformMatch[1]) {
      currentPlatform = canonicalizePlatformHeader(platformMatch[1].trim());
      continue;
    }

    // Match entry format: - [Title](file): Description
    const entryMatch = line.match(/^-\s*\[(.*?)\]\((.*?)\)(?::\s*(.*))?$/);
    if (entryMatch) {
      const [, title, file, description] = entryMatch;
      if (title && file) {
        entries.push({
          platform: currentPlatform,
          title: title.trim(),
          file: file.trim(),
          description: description?.trim(),
        });
      }
    }
  }

  return entries;
}

/**
 * Search SDK entries by query and platform using BM25 algorithm
 * If platform is specified, only returns results from that platform
 * Uses industry-standard BM25 ranking
 */
function searchSdk(
  entries: SdkEntry[],
  query: string,
  platform: string,
  maxResults: number
): SdkEntry[] {
  // Filter by platform first if specified
  const filteredEntries =
    platform !== "all" ? entries.filter((entry) => entry.platform === platform) : entries;

  if (filteredEntries.length === 0) {
    return [];
  }

  // Initialize BM25 with field weights optimized for SDK search
  const bm25 = new BM25({
    k1: 1.5, // Term frequency saturation
    b: 0.75, // Document length normalization
    fieldWeights: {
      title: 3.0, // Title (e.g., "Notification Service") is most important
      description: 1.5, // Description has good context
      file: 1.0, // File path can contain useful keywords
      platform: 0.5, // Platform is least important (already filtered)
    },
  });

  // Convert SDK entries to BM25 document format
  const documents = filteredEntries.map((entry, index) => ({
    id: index.toString(),
    fields: {
      title: entry.title || "",
      description: entry.description || "",
      file: entry.file || "",
      platform: entry.platform || "",
    },
  }));

  // Index documents
  bm25.indexDocuments(documents);

  // Search using BM25
  const results = bm25.search(query, maxResults);

  // Map back to SdkEntry objects
  return results
    .map((result) => filteredEntries[parseInt(result.id)])
    .filter((entry): entry is SdkEntry => entry !== undefined);
}

// Mapping index (aggregator) lives in this repository and lists per-SDK llms.txt URLs
const SDK_LLMS_BASE = "https://raw.githubusercontent.com/clix-so/clix-mcp-server/refs/heads/main";
const MAPPING_LLMS_URL = `${SDK_LLMS_BASE}/llms.txt`;

function findNearestPackageRoot(startDir: string): string {
  // Walk up directories until a package.json is found or root is reached
  let current = startDir;
  for (let i = 0; i < 8; i++) {
    const pkgJson = path.join(current, "package.json");
    if (existsSync(pkgJson)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

function pickLocalSdkLlmsPath(): string {
  // Local fallback for mapping file
  const filename = "llms.txt";
  // Resolve relative to module, then walk to the nearest package root.
  // Works both when running from src/ (dev) and dist/ (published).
  const __filename = fileURLToPath((import.meta as any).url);
  const __dirname = path.dirname(__filename);
  const pkgRoot = findNearestPackageRoot(__dirname);
  return path.join(pkgRoot, filename);
}

async function fetchTextWithTimeout(url: string, userFriendlyName: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": MCP_USER_AGENT, Accept: "text/plain, */*" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`Unable to load ${userFriendlyName} (HTTP ${response.status})`);
    }
    return await response.text();
  } catch (err) {
    clearTimeout(timer);
    throw new Error(
      `Failed to load ${userFriendlyName} from GitHub raw. ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Parse mapping llms.txt to extract per-SDK llms.txt URLs.
 * Accepts:
 *  - Markdown list items containing a (...) URL ending with /llms.txt
 *  - Plain lines that are URLs ending with /llms.txt
 */
function parseMappingLlmsUrls(content: string): string[] {
  const urls = new Set<string>();
  const lines = content.split("\n");
  const urlRegex = /\((https?:\/\/[^\s)]+\/llms\.txt)\)/i;
  const plainUrlRegex = /^(https?:\/\/[^\s)]+\/llms\.txt)\s*$/i;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m1 = line.match(urlRegex);
    if (m1 && m1[1]) {
      urls.add(m1[1]);
      continue;
    }
    const m2 = line.match(plainUrlRegex);
    if (m2 && m2[1]) {
      urls.add(m2[1]);
      continue;
    }
  }
  return Array.from(urls);
}

/**
 * Fetch content from a GitHub raw URL
 * Supports fetching source code from SDK repositories
 */
async function fetchSdkContent(url: string): Promise<string> {
  try {
    // If it's a GitHub raw URL, fetch the content
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT);

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": MCP_USER_AGENT,
            Accept: "text/plain, */*",
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          // Provide clearer messages for specific status codes
          if (response.status === 429) {
            return `Rate limited by GitHub (HTTP 429). Please try again later.`;
          }
          if (response.status >= 500) {
            return `GitHub server error (HTTP ${response.status}). Please try again later.`;
          }
          return `Unable to fetch content (HTTP ${response.status})`;
        }

        const content = await response.text();

        // Limit content length to avoid overwhelming responses
        const maxLength = 5000;
        if (content.length > maxLength) {
          return content.substring(0, maxLength) + "\n\n...(truncated for brevity)";
        }

        return content;
      } catch (fetchError) {
        clearTimeout(timer);
        if ((fetchError as Error).name === "AbortError") {
          return `Request timeout after ${DEFAULT_API_TIMEOUT}ms. GitHub may be slow or unreachable.`;
        }
        throw fetchError;
      }
    }

    // If it's not a GitHub URL, return a placeholder
    return `Source code is not available online. Please check the SDK repository manually: ${url}`;
  } catch (error) {
    return `Error fetching content: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export const sdkSearchTool: ToolDefinition<SdkSearchInput, string> = {
  name: "search_sdk",
  description: SDK_SEARCH_DESCRIPTION,
  inputSchema: {
    query: sdkSearchInputSchema.shape.query,
    platform: sdkSearchInputSchema.shape.platform,
    maxResults: sdkSearchInputSchema.shape.maxResults,
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
  async handler(params: SdkSearchInput, _context: ServerContext): Promise<string> {
    try {
      // Load mapping llms.txt (list of per-SDK llms.txt URLs)
      const mappingUrl = MAPPING_LLMS_URL;
      const localPath = pickLocalSdkLlmsPath();
      // Prefer online mapping (always up-to-date). Fallback to local llms.txt when offline/unavailable.
      let mappingContent: string;
      try {
        mappingContent = await fetchTextWithTimeout(mappingUrl, "mapping llms.txt");
      } catch {
        try {
          mappingContent = await readFile(localPath, "utf8");
        } catch {
          throw new ApiError(
            `Unable to load mapping index from network (${mappingUrl}) and local fallback (${localPath}).`
          );
        }
      }

      // Extract per-SDK llms.txt URLs and fetch them all in parallel
      const perSdkUrls = parseMappingLlmsUrls(mappingContent);
      if (perSdkUrls.length === 0) {
        throw new ApiError(`Mapping llms.txt did not contain any per-SDK indexes.`);
      }
      const perSdkContents = await Promise.all(
        perSdkUrls.map(async (url) => {
          try {
            return await fetchTextWithTimeout(url, `SDK llms.txt (${url})`);
          } catch {
            // If one fails, return empty to avoid failing entire search; user still gets partial results
            return "";
          }
        })
      );

      // Parse and aggregate entries across SDKs
      const allEntries = perSdkContents.filter((c) => !!c).flatMap((c) => parseSdkLlmsTxt(c));
      if (allEntries.length === 0) {
        return `[Warning] No SDK Documentation Available\n\nUnable to parse any SDK llms.txt. Please ensure each SDK has a valid llms.txt and the mapping file lists them.`;
      }

      // Search SDK entries
      const results = searchSdk(
        allEntries,
        params.query,
        params.platform || "all",
        params.maxResults || SDK_SEARCH_MAX_RESULTS
      );

      if (results.length === 0) {
        return `[No Results] No Results Found\n\nQuery: "${params.query}"\nPlatform: ${params.platform || "all"}\n\nNo SDK code found matching your query. Try using different keywords or broader search terms.`;
      }

      // Format output with fetched content
      let output = `# Clix SDK Search Results\n\n`;
      output += `**Query**: "${params.query}"\n`;
      output += `**Platform Filter**: ${params.platform || "all"}\n`;
      output += `**Results**: Found ${results.length} most relevant file${results.length === 1 ? "" : "s"}\n\n`;

      // Add summary of what was found
      output += `## Summary\n\n`;
      output += `The following SDK files are most relevant to your query. Each entry includes the actual source code fetched from GitHub:\n\n`;
      for (const [index, entry] of results.entries()) {
        output += `${index + 1}. **${entry.title}** (${entry.platform})\n`;
      }
      output += `\n---\n\n`;

      // Fetch all source codes in parallel for better latency
      const sourceCodes = await Promise.all(results.map((entry) => fetchSdkContent(entry.file)));

      // Display code for each result
      for (let i = 0; i < results.length; i++) {
        const entry = results[i];
        const sourceCode = sourceCodes[i];

        if (!entry) continue;

        output += `## Result ${i + 1}: ${entry.title}\n\n`;
        output += `**Platform**: ${entry.platform}\n`;
        output += `**GitHub Source**: ${entry.file}\n\n`;

        if (entry.description) {
          output += `**Description**:\n${entry.description}\n\n`;
        }

        // Format as code block based on file extension
        output += `### Source Code\n\n`;
        const ext = entry.file.split(".").pop()?.toLowerCase();
        const language =
          ext === "kt"
            ? "kotlin"
            : ext === "swift"
              ? "swift"
              : ext === "dart"
                ? "dart"
                : ext === "ts" || ext === "tsx"
                  ? "typescript"
                  : ext === "js" || ext === "jsx"
                    ? "javascript"
                    : "";

        output += `\`\`\`${language}\n${sourceCode}\n\`\`\`\n\n`;

        if (i < results.length - 1) {
          output += `---\n\n`;
        }
      }

      // Add helpful footer
      output += `\n---\n\n`;
      output += `**Note**: All source code above is fetched directly from the Clix SDK repositories. You can use this code to understand implementation details, debug issues, or learn best practices.\n`;

      return output;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `SDK search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};

/**
 * Clix CLI Tool
 *
 * Fetches and returns Clix CLI installation and usage instructions
 * for AI agents to understand how to integrate Clix SDK into mobile projects.
 */

import type { ToolDefinition, ServerContext } from "../types.js";
import { MCP_USER_AGENT, DEFAULT_API_TIMEOUT } from "../constants.js";
import { ApiError } from "../errors.js";
import { CLIX_CLI_DESCRIPTION } from "./descriptions.js";

const CLI_LLMS_URL = "https://raw.githubusercontent.com/clix-so/homebrew-clix-cli/refs/heads/main/llms.txt";

export const clixCliTool: ToolDefinition<Record<string, never>, string> = {
  name: "clix_cli",
  description: CLIX_CLI_DESCRIPTION,
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
    title: "Clix CLI",
  },
  async handler(_params: Record<string, never>, _context: ServerContext): Promise<string> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT);

      try {
        const response = await fetch(CLI_LLMS_URL, {
          headers: {
            "User-Agent": MCP_USER_AGENT,
            Accept: "text/plain",
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new ApiError(
            `Failed to fetch Clix CLI instructions: ${response.status} ${response.statusText}`,
            response.status
          );
        }

        const content = await response.text();

        let output = `# Clix CLI - Installation & Usage Guide\n\n`;
        output += `**Source**: ${CLI_LLMS_URL}\n\n`;
        output += `---\n\n`;
        output += content;
        output += `\n\n---\n\n`;
        output += `**Tip**: Run \`clix --help\` or \`clix <command> --help\` for detailed command usage.`;

        return output;
      } catch (fetchError) {
        clearTimeout(timer);
        if ((fetchError as Error).name === "AbortError") {
          throw new ApiError(
            `Request timeout after ${DEFAULT_API_TIMEOUT}ms. GitHub may be slow or unreachable.`
          );
        }
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to get CLI instructions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};


#!/usr/bin/env node

/**
 * Clix MCP Server - Main Entry Point
 *
 * Standalone MCP Server using StdioServerTransport for AI-powered
 * Clix SDK and API integration assistance.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { MCP_TOOLS } from "./tools/index.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, DEFAULT_API_BASE_URL } from "./constants.js";
import { formatErrorForUser, ConfigurationError, ValidationError } from "./errors.js";
import type { ServerContext } from "./types.js";
// HTTP transport archived - see docs/archive/ for implementation

/**
 * Parse command-line arguments
 */
function parseArgs(): {
  help?: boolean;
  version?: boolean;
} {
  const args = process.argv.slice(2);
  const parsed: { help?: boolean; version?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--version" || arg === "-v") {
      parsed.version = true;
    }
  }

  return parsed;
}

/**
 * Display help message
 * NOTE: This writes to stderr to comply with MCP stdio specification
 * All help/version info goes to stderr, not stdout
 */
function displayHelp(): void {
  console.error(`
${MCP_SERVER_NAME} v${MCP_SERVER_VERSION}

Usage:
  clix-mcp-server [options]
  npx @clix-so/clix-mcp-server [options]

Options:
  --version, -v            Show version number
  --help, -h               Show this help message

Note: HTTP transport has been archived. Only stdio transport is available.

Examples:
  clix-mcp-server

MCP Client Configuration:
  Add this to your MCP client configuration file:

  {
    "mcpServers": {
      "clix": {
        "command": "npx",
        "args": ["-y", "@clix-so/clix-mcp-server@latest"]
      }
    }
  }

Documentation:
  https://docs.clix.so/mcp-server
  https://github.com/clix-so/clix-mcp-server
`);
}

/**
 * Main server function
 */
async function main() {
  // Parse arguments
  const args = parseArgs();

  // Handle --version
  if (args.version) {
    // Write to stderr - help/version should not interfere with MCP protocol
    console.error(`${MCP_SERVER_VERSION}`);
    process.exit(0);
  }

  // Handle --help
  if (args.help) {
    // Write to stderr - help/version should not interfere with MCP protocol
    displayHelp();
    process.exit(0);
  }

  // Get configuration from environment
  const apiBaseUrl = DEFAULT_API_BASE_URL;

  // No API key required for search-only tools
  const apiKeyEnv = "";

  // Create server context
  const context: ServerContext = {
    apiKey: apiKeyEnv,
    apiBaseUrl,
  };

  // Create MCP server instance
  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.entries(MCP_TOOLS).map(([name, tool]) => {
      // Convert Zod schema to JSON Schema for MCP compliance
      const zodObject = z.object(tool.inputSchema);
      const jsonSchema = zodToJsonSchema(zodObject, {
        target: "jsonSchema7",
        $refStrategy: "none",
      });

      return {
        name,
        description: tool.description || `Tool: ${name}`,
        inputSchema: jsonSchema as any,
      };
    });

    return { tools };
  });

  // Register tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    const tool = MCP_TOOLS[name as keyof typeof MCP_TOOLS];
    if (!tool) {
      throw new ConfigurationError(
        `Tool not found: ${name}. Available tools: ${Object.keys(MCP_TOOLS).join(", ")}`
      );
    }

    try {
      // Validate arguments using Zod schema before invoking the tool
      const zodObject = z.object(tool.inputSchema);
      const parseResult = zodObject.safeParse(rawArgs || {});

      if (!parseResult.success) {
        const errorDetails = parseResult.error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");
        throw new ValidationError(`Invalid arguments: ${errorDetails}`);
      }

      // Execute tool with validated arguments
      const result = await tool.handler(parseResult.data as any, context);

      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Format error for user-friendly display
      const errorMessage = formatErrorForUser(error);

      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  });

  // HTTP transport has been archived - only stdio transport is available
  // Check if user tried to use HTTP transport
  const useHttp = process.argv.includes("--http") || process.env.CLIX_USE_HTTP === "true";

  if (useHttp) {
    console.error("[Error] HTTP transport has been archived and is not available in this build.");
    console.error(
      "Please use stdio transport (default) or check docs/archive/ for HTTP implementation."
    );
    process.exit(1);
  }

  // Use stdio transport (default)
  // Per MCP stdio specification:
  // - stdout: ONLY valid MCP messages (JSON-RPC)
  // - stderr: Logging and diagnostics (optional)
  // - stdin: ONLY valid MCP messages (JSON-RPC)
  // - Messages delimited by newlines
  // - StdioServerTransport from SDK handles this automatically
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  // This is per MCP spec: stderr is for optional logging
  console.error(`${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} connected (stdio)`);
  console.error(`API Base URL: ${apiBaseUrl}`);
}

// Run the server
main().catch((error) => {
  // Fatal errors always go to stderr per MCP stdio specification
  console.error("[Fatal Error] Fatal error running MCP server:", error);
  process.exit(1);
});

/**
 * MCP Tools Registry
 *
 * Central export of all available tools for the Clix MCP Server
 */

import { clixCliTool } from "./clix-cli.js";
import { docsSearchTool } from "./search-docs.js";
import { sdkSearchTool } from "./search-sdk.js";

/**
 * All tools mapped by their command names
 */
export const MCP_TOOLS = {
  clix_CLI: clixCliTool,
  search_docs: docsSearchTool,
  search_sdk: sdkSearchTool,
} as const;

export type ToolName = keyof typeof MCP_TOOLS;

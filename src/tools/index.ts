/**
 * MCP Tools Registry
 *
 * Central export of all available tools for the Clix MCP Server
 */

import { docsSearchTool } from "./search-docs.js";
import { sdkSearchTool } from "./search-sdk.js";

/**
 * All tools mapped by their command names
 */
export const MCP_TOOLS = {
  search_docs: docsSearchTool,
  search_sdk: sdkSearchTool,
} as const;

export type ToolName = keyof typeof MCP_TOOLS;

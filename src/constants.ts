/**
 * Constants and configuration values for Clix MCP Server
 */

import pkg from "../package.json" with { type: "json" };

/** MCP Server name */
export const MCP_SERVER_NAME = "Clix MCP Server";

/** MCP Server version - sourced from package.json */
export const MCP_SERVER_VERSION = (pkg as { version?: string }).version ?? "0.1.0";

/** Reusable User-Agent string for HTTP requests */
export const MCP_USER_AGENT = `Clix-MCP-Server/${MCP_SERVER_VERSION}`;

/** Default Clix API base URL */
export const DEFAULT_API_BASE_URL = "https://api.clix.so";

/** Default timeout for API requests (ms) */
export const DEFAULT_API_TIMEOUT = parseInt(
  process.env.DEFAULT_API_TIMEOUT || process.env.API_TIMEOUT || "30000",
  10
);

/** Maximum number of retry attempts for failed API calls */
export const MAX_API_RETRIES = parseInt(
  process.env.MAX_API_RETRIES || process.env.API_RETRIES || "3",
  10
);

/** Docs search default max results */
export const DOCS_SEARCH_MAX_RESULTS = parseInt(process.env.DOCS_SEARCH_MAX_RESULTS || "3", 10);

/** SDK search default max results */
export const SDK_SEARCH_MAX_RESULTS = parseInt(process.env.SDK_SEARCH_MAX_RESULTS || "3", 10);

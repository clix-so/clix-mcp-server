/**
 * Core type system for Clix MCP Server.
 *
 * Defines TypeScript types for server context, tool handlers,
 * API client, and MCP integration.
 */

/**
 * Server context containing authentication and configuration
 * passed to all tool handlers
 */
export type ServerContext = {
  /** Clix API authentication key */
  apiKey: string;
  /** Base URL for Clix API */
  apiBaseUrl: string;
  /** Optional user ID for authenticated session */
  userId?: string | null;
  /** Optional client identifier (e.g., "cursor", "vscode") */
  clientId?: string;
};

/**
 * Tool definition structure following MCP protocol
 */
export type ToolDefinition<TInput = any, TOutput = any> = {
  /** Tool name used for invocation */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for input validation */
  inputSchema: Record<string, any>;
  /** Tool handler function */
  handler: (params: TInput, context: ServerContext) => Promise<TOutput>;
  /** Optional annotations for MCP hints */
  annotations?: {
    readOnlyHint?: boolean;
    openWorldHint?: boolean;
    title?: string;
  };
};

/**
 * Clix API response wrapper
 */
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * Organization entity from Clix API
 */
export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

/**
 * Project entity from Clix API
 */
export type Project = {
  id: string;
  name: string;
  organizationId: string;
  apiKey?: string;
  createdAt: string;
};

/**
 * Campaign entity from Clix API
 */
export type Campaign = {
  id: string;
  name: string;
  projectId: string;
  status: "active" | "inactive" | "draft";
  createdAt: string;
};

/**
 * Generic message send request payload (email, SMS, etc.)
 */
export type GenericMessagePayload = {
  projectId: string;
  to: string;
  subject?: string;
  body: string;
  templateId?: string;
};

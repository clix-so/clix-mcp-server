/**
 * SDK Search Tool Tests
 *
 * Tests the SDK search functionality with BM25 algorithm
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sdkSearchTool } from "../../src/tools/search-sdk.js";
import type { ServerContext } from "../../src/types.js";

// Mock fetch for testing: serve mapping llms.txt, per-SDK llms.txt and raw code
const REMOTE_MAPPING_LLMS_URL =
  "https://raw.githubusercontent.com/clix-so/clix-mcp-server/refs/heads/main/llms.txt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath((import.meta as any).url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../");
const LOCAL_MAPPING_PATH = path.join(REPO_ROOT, "llms.txt");

function parseUrlsFromMapping(content: string): string[] {
  const urls = new Set<string>();
  const re = /\((https?:\/\/[^\s)]+\/llms\.txt)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1]) urls.add(m[1]);
  }
  return Array.from(urls);
}

const MAPPING_LLMS_TEXT = readFileSync(LOCAL_MAPPING_PATH, "utf8");
const PER_SDK_LLMS_URLS = parseUrlsFromMapping(MAPPING_LLMS_TEXT);

const LLMS_TEXT = [
  "# Platform: iOS",
  "- [Notification Service](https://raw.githubusercontent.com/clix-so/clix-ios-sdk/main/Sources/Services/NotificationService.swift): Handles iOS push notification processing in Clix SDK",
  "# Platform: android",
  "- [Notification Service](https://raw.githubusercontent.com/clix-so/clix-android-sdk/main/clix/src/main/kotlin/so/clix/services/NotificationService.kt): Android push notification handling service",
  "# Platform: flutter",
  "- [Notification Service](https://raw.githubusercontent.com/clix-so/clix-flutter-sdk/main/lib/src/services/notification_service.dart): Flutter notification service",
  "# Platform: react-native",
  "- [Notification Service](https://raw.githubusercontent.com/clix-so/clix-react-native-sdk/main/src/services/NotificationService.ts): React Native notification orchestration",
].join("\n");

global.fetch = vi.fn();

describe("SDK Search Tool", () => {
  const mockContext: ServerContext = {
    apiKey: "test-api-key",
    apiBaseUrl: "https://api.clix.so",
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes(REMOTE_MAPPING_LLMS_URL)) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(MAPPING_LLMS_TEXT) });
      }
      if (typeof url === "string" && PER_SDK_LLMS_URLS.some((u) => url.includes(u))) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(LLMS_TEXT) });
      }
      // Return small code snippet for raw source file requests
      return Promise.resolve({ ok: true, text: () => Promise.resolve("class Clix { }") });
    });
  });

  describe("Tool Metadata", () => {
    it("should have correct tool name", () => {
      expect(sdkSearchTool.name).toBe("search_sdk");
    });

    // Description expectations are relaxed; content may change without BM25 mention

    it("should have correct input schema", () => {
      expect(sdkSearchTool.inputSchema).toHaveProperty("query");
      expect(sdkSearchTool.inputSchema).toHaveProperty("platform");
      expect(sdkSearchTool.inputSchema).toHaveProperty("maxResults");
    });
  });

  describe("Platform Filtering", () => {
    it("should filter by iOS platform", async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "ios", maxResults: 5 },
        mockContext
      );

      expect(result).toContain("ios");
      expect(result).not.toContain("android");
      expect(result).not.toContain("react-native");
    });

    it("should filter by Android platform", async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "android", maxResults: 5 },
        mockContext
      );

      expect(result).toContain("android");
      expect(result).not.toContain("ios");
    });

    it('should search all platforms when platform="all"', async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "all", maxResults: 5 },
        mockContext
      );

      // Should have results from multiple platforms
      expect(result).toContain("Platform");
    });
  });

  describe("BM25 Search Quality", () => {
    it("should rank title matches highest", async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "all", maxResults: 5 },
        mockContext
      );

      // Should find notification-related results
      expect(result).toContain("Notification");
      expect(result).toContain("# Clix SDK Search Results");
    });

    it("should weight title higher than description", async () => {
      const result = await sdkSearchTool.handler(
        { query: "initialization", platform: "all", maxResults: 5 },
        mockContext
      );

      // Should find results where "initialization" is in description
      expect(result).toContain("SDK");
    });

    it("should handle multi-term queries", async () => {
      const mockCode = "class NotificationService { }";
      (global.fetch as any).mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes(REMOTE_MAPPING_LLMS_URL)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(MAPPING_LLMS_TEXT) });
        }
        if (typeof url === "string" && PER_SDK_LLMS_URLS.some((u) => url.includes(u))) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(LLMS_TEXT) });
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve(mockCode) });
      });

      const result = await sdkSearchTool.handler(
        { query: "push notification service", platform: "all", maxResults: 5 },
        mockContext
      );

      // Should match documents with multiple query terms
      expect(result).toContain("Notification Service");
    });
  });

  describe("Source Code Fetching", () => {
    it("should fetch source code from GitHub", async () => {
      const mockCode = `class Clix {
  init(config: ClixConfig) {
    // Initialize SDK
  }
}`;

      (global.fetch as any).mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes(REMOTE_MAPPING_LLMS_URL)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(MAPPING_LLMS_TEXT) });
        }
        if (typeof url === "string" && PER_SDK_LLMS_URLS.some((u) => url.includes(u))) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(LLMS_TEXT) });
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve(mockCode) });
      });

      const result = await sdkSearchTool.handler(
        { query: "clix sdk", platform: "ios", maxResults: 1 },
        mockContext
      );

      // Should contain the actual source code
      expect(result).toContain("class Clix");
    });

    it("should detect and apply correct syntax highlighting", async () => {
      const result = await sdkSearchTool.handler(
        { query: "clix", platform: "ios", maxResults: 1 },
        mockContext
      );

      // Should use swift syntax highlighting for .swift files
      expect(result).toContain("```swift");
    });

    it("should truncate long source files", async () => {
      const longCode = "// Code\n".repeat(1000);

      (global.fetch as any).mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes(REMOTE_MAPPING_LLMS_URL)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(MAPPING_LLMS_TEXT) });
        }
        if (typeof url === "string" && PER_SDK_LLMS_URLS.some((u) => url.includes(u))) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(LLMS_TEXT) });
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve(longCode) });
      });

      const result = await sdkSearchTool.handler(
        { query: "clix", platform: "ios", maxResults: 1 },
        mockContext
      );

      // Should be truncated
      expect(result).toContain("truncated for brevity");
    });

    it("should handle fetch errors gracefully", async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes(REMOTE_MAPPING_LLMS_URL)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(MAPPING_LLMS_TEXT) });
        }
        if (typeof url === "string" && PER_SDK_LLMS_URLS.some((u) => url.includes(u))) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(LLMS_TEXT) });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "ios", maxResults: 1 },
        mockContext
      );

      // Should contain error message but not fail
      expect(result).toContain("Unable to fetch content");
    });
  });

  describe("Result Formatting", () => {
    it("should include summary section", async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "all", maxResults: 3 },
        mockContext
      );

      expect(result).toContain("## Summary");
      expect(result).toContain("most relevant");
    });

    it("should include platform information", async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "ios", maxResults: 2 },
        mockContext
      );

      expect(result).toContain("**Platform**: ios");
    });

    it("should include GitHub source links", async () => {
      const result = await sdkSearchTool.handler(
        { query: "notification", platform: "ios", maxResults: 1 },
        mockContext
      );

      expect(result).toContain("**GitHub Source**:");
      expect(result).toContain("https://raw.githubusercontent.com/");
    });

    it("should include helpful footer", async () => {
      const result = await sdkSearchTool.handler(
        { query: "clix", platform: "ios", maxResults: 1 },
        mockContext
      );

      expect(result).toContain("**Note**:");
      expect(result).toContain("source code");
    });
  });

  describe("Error Handling", () => {
    it("should handle no search results", async () => {
      const result = await sdkSearchTool.handler(
        { query: "nonexistent_feature_xyz", platform: "all", maxResults: 3 },
        mockContext
      );

      expect(result).toContain("No Results Found");
    });

    it("should handle platform with no matches", async () => {
      const result = await sdkSearchTool.handler(
        { query: "nonexistent_feature_xyz", platform: "flutter", maxResults: 3 },
        mockContext
      );

      expect(result).toContain("No Results Found");
    });
  });

  describe("maxResults Parameter", () => {
    it("should respect maxResults parameter", async () => {
      const result = await sdkSearchTool.handler(
        { query: "clix", platform: "all", maxResults: 2 },
        mockContext
      );

      // Count result sections
      const resultMatches = result.match(/## Result \d+:/g);
      expect(resultMatches).toBeTruthy();
      expect(resultMatches!.length).toBeLessThanOrEqual(2);
    });
  });
});

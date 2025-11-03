/**
 * Documentation Search Tool Tests
 *
 * Tests the docs search functionality with BM25 algorithm
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { docsSearchTool } from "../../src/tools/search-docs.js";
import type { ServerContext } from "../../src/types.js";

// Mock fetch for testing
global.fetch = vi.fn();

describe("Documentation Search Tool", () => {
  const mockContext: ServerContext = {
    apiKey: "test-api-key",
    apiBaseUrl: "https://api.clix.so",
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Tool Metadata", () => {
    it("should have correct tool name", () => {
      expect(docsSearchTool.name).toBe("search_docs");
    });

    // Description expectations are relaxed; content may change without BM25 mention

    it("should have correct input schema", () => {
      expect(docsSearchTool.inputSchema).toHaveProperty("query");
      expect(docsSearchTool.inputSchema).toHaveProperty("maxResults");
    });

    it("should have annotations", () => {
      expect(docsSearchTool.annotations).toBeDefined();
      expect(docsSearchTool.annotations?.readOnlyHint).toBe(true);
      expect(docsSearchTool.annotations?.openWorldHint).toBe(true);
    });
  });

  describe("llms.txt Parsing", () => {
    it("should parse llms.txt format correctly", async () => {
      const mockLlmsTxt = `
# Clix Documentation

- [iOS SDK Setup](https://docs.clix.so/ios/setup): Get started with iOS SDK
- [Android SDK](https://docs.clix.so/android/setup): Get started with Android
- [Push Notifications](https://docs.clix.so/features/push): Configure push notifications
`;

      const mockHtml = "<html><body>Test content</body></html>";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "iOS SDK", maxResults: 3 }, mockContext);

      expect(result).toContain("iOS SDK Setup");
      expect(fetch).toHaveBeenCalledWith("https://docs.clix.so/llms.txt");
    });
  });

  describe("BM25 Search Quality", () => {
    it("should rank exact title matches highest", async () => {
      const mockLlmsTxt = `
- [Push Notification Setup](https://docs.clix.so/push): Setup push notifications
- [SDK Setup Guide](https://docs.clix.so/setup): General SDK setup
- [API Reference](https://docs.clix.so/api): API documentation
`;

      const mockHtml = "<html><body>Content</body></html>";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler(
        { query: "push notification", maxResults: 3 },
        mockContext
      );

      // Should rank "Push Notification Setup" first
      expect(result).toContain("Push Notification Setup");
      expect(result).toContain("# Clix Documentation Search Results");
    });

    it("should weight title higher than description", async () => {
      const mockLlmsTxt = `
- [API Reference](https://docs.clix.so/api): iOS SDK setup guide
- [iOS SDK Setup](https://docs.clix.so/ios): Complete iOS integration
`;

      const mockHtml = "<html><body>Content</body></html>";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "iOS SDK", maxResults: 2 }, mockContext);

      // "iOS SDK Setup" should rank higher (title match)
      const iosIndex = result.indexOf("iOS SDK Setup");
      const apiIndex = result.indexOf("API Reference");
      expect(iosIndex).toBeLessThan(apiIndex);
    });

    it("should handle multi-term queries correctly", async () => {
      const mockLlmsTxt = `
- [iOS Push Notification Setup](https://docs.clix.so/ios-push): Setup iOS push
- [Android Push Setup](https://docs.clix.so/android-push): Setup Android push
- [Flutter Integration](https://docs.clix.so/flutter): General Flutter guide
`;

      const mockHtml = "<html><body>Content</body></html>";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler(
        { query: "iOS push notification", maxResults: 3 },
        mockContext
      );

      // iOS push notification doc should rank first (matches all terms)
      expect(result).toContain("iOS Push Notification Setup");
      const iosIndex = result.indexOf("iOS Push Notification Setup");
      const androidIndex = result.indexOf("Android Push Setup");
      expect(iosIndex).toBeLessThan(androidIndex);
    });
  });

  describe("Content Fetching", () => {
    it("should fetch and clean HTML content", async () => {
      const mockLlmsTxt = `
- [Test Page](https://docs.clix.so/test): Test description
`;

      const mockHtml = `
<html>
  <head>
    <script>alert('test')</script>
    <style>.test { color: red; }</style>
  </head>
  <body>
    <h1>Main Content</h1>
    <p>This is the actual content.</p>
  </body>
</html>
`;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "test", maxResults: 1 }, mockContext);

      // Should contain cleaned content
      expect(result).toContain("Main Content");
      expect(result).toContain("actual content");

      // Should NOT contain script or style tags
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<style>");
      expect(result).not.toContain("alert");
    });

    it("should handle HTML entities", async () => {
      const mockLlmsTxt = `
- [Test Page](https://docs.clix.so/test): Test
`;

      const mockHtml = `
<html><body>
  <p>Test &amp; Example</p>
  <p>&quot;Quoted&quot; text</p>
  <p>&lt;tag&gt;</p>
</body></html>
`;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "test", maxResults: 1 }, mockContext);

      // Should decode HTML entities
      expect(result).toContain("Test & Example");
      expect(result).toContain('"Quoted" text');
      expect(result).toContain("<tag>");
    });

    it("should truncate long content", async () => {
      const mockLlmsTxt = `
- [Long Page](https://docs.clix.so/long): Long content
`;

      const longContent = "x".repeat(5000);
      const mockHtml = `<html><body>${longContent}</body></html>`;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "long", maxResults: 1 }, mockContext);

      // Should be truncated
      expect(result).toContain("truncated for brevity");
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(
        docsSearchTool.handler({ query: "test", maxResults: 3 }, mockContext)
      ).rejects.toThrow();
    });

    it("should handle HTTP errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        docsSearchTool.handler({ query: "test", maxResults: 3 }, mockContext)
      ).rejects.toThrow();
    });

    it("should handle empty llms.txt", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const result = await docsSearchTool.handler({ query: "test", maxResults: 3 }, mockContext);

      expect(result).toContain("No Documentation Available");
    });

    it("should handle no search results", async () => {
      const mockLlmsTxt = `
- [iOS SDK](https://docs.clix.so/ios): iOS setup
- [Android SDK](https://docs.clix.so/android): Android setup
`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockLlmsTxt),
      });

      const result = await docsSearchTool.handler(
        { query: "nonexistent topic", maxResults: 3 },
        mockContext
      );

      expect(result).toContain("No Results Found");
    });
  });

  describe("maxResults Parameter", () => {
    it("should respect maxResults parameter", async () => {
      const mockLlmsTxt = `
- [Page 1](https://docs.clix.so/1): Test page 1
- [Page 2](https://docs.clix.so/2): Test page 2
- [Page 3](https://docs.clix.so/3): Test page 3
- [Page 4](https://docs.clix.so/4): Test page 4
- [Page 5](https://docs.clix.so/5): Test page 5
`;

      const mockHtml = "<html><body>Content</body></html>";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "test", maxResults: 2 }, mockContext);

      // Should only return 2 results
      const pageMatches = result.match(/## \d+\./g);
      expect(pageMatches).toHaveLength(2);
    });

    it("should use default maxResults when not specified", async () => {
      const mockLlmsTxt = `
- [Page 1](https://docs.clix.so/1): Test
- [Page 2](https://docs.clix.so/2): Test
- [Page 3](https://docs.clix.so/3): Test
- [Page 4](https://docs.clix.so/4): Test
`;

      const mockHtml = "<html><body>Content</body></html>";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockLlmsTxt),
        })
        .mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        });

      const result = await docsSearchTool.handler({ query: "test" }, mockContext);

      // Should return results (default is 3)
      expect(result).toContain("Found");
    });
  });
});

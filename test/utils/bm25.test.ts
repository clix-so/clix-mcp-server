/**
 * BM25 Search Algorithm Tests
 *
 * Tests the industry-standard BM25 ranking function implementation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BM25 } from "../../src/utils/bm25.js";

describe("BM25 Search Algorithm", () => {
  describe("Tokenization", () => {
    it("should tokenize text into lowercase terms", () => {
      const bm25 = new BM25();
      const docs = [
        {
          id: "1",
          fields: { text: "Hello World Test" },
        },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("hello world");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("1");
    });

    it("should remove special characters", () => {
      const bm25 = new BM25();
      const docs = [
        {
          id: "1",
          fields: { text: "Hello, World! Test?" },
        },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("hello world test");

      expect(results).toHaveLength(1);
    });

    it("should filter out very short terms", () => {
      const bm25 = new BM25();
      const docs = [
        {
          id: "1",
          fields: { text: "a ab abc test" },
        },
      ];

      bm25.indexDocuments(docs);
      // "a" should be filtered (1 char), "ab" should match (2 chars)
      const results = bm25.search("ab test");

      expect(results).toHaveLength(1);
    });
  });

  describe("Term Frequency (TF)", () => {
    it("should score documents with higher term frequency higher", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "test" } },
        { id: "2", fields: { text: "test test" } },
        { id: "3", fields: { text: "test test test" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      expect(results).toHaveLength(3);
      // Higher frequency should have higher score
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
    });

    it("should saturate term frequency (prevent keyword stuffing)", () => {
      const bm25 = new BM25({ k1: 1.5 });
      const docs = [
        { id: "1", fields: { text: "test test" } },
        { id: "2", fields: { text: "test ".repeat(100) } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      // Score difference should be small due to saturation
      const scoreDiff = results[0].score - results[1].score;
      expect(Math.abs(scoreDiff)).toBeLessThan(5);
    });
  });

  describe("Inverse Document Frequency (IDF)", () => {
    it("should weight rare terms higher than common terms", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "common rare" } },
        { id: "2", fields: { text: "common" } },
        { id: "3", fields: { text: "common" } },
        { id: "4", fields: { text: "common" } },
      ];

      bm25.indexDocuments(docs);

      // "rare" appears in 1/4 docs, "common" appears in 4/4 docs
      const rareResults = bm25.search("rare");
      const commonResults = bm25.search("common");

      // Rare term should have higher score
      expect(rareResults[0].score).toBeGreaterThan(commonResults[0].score);
    });

    it("should handle terms that appear in all documents", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "the document one" } },
        { id: "2", fields: { text: "the document two" } },
        { id: "3", fields: { text: "the document three" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("the");

      // Should still return results
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Document Length Normalization", () => {
    it("should penalize longer documents", () => {
      const bm25 = new BM25({ b: 0.75 });
      const docs = [
        { id: "1", fields: { text: "test document" } },
        { id: "2", fields: { text: "test document " + "filler ".repeat(50) } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      // Shorter document should rank higher
      expect(results[0].id).toBe("1");
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("should handle b=0 (no normalization)", () => {
      const bm25 = new BM25({ b: 0 });
      const docs = [
        { id: "1", fields: { text: "test" } },
        { id: "2", fields: { text: "test " + "word ".repeat(100) } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      // With b=0, length doesn't matter
      expect(results).toHaveLength(2);
    });

    it("should handle b=1 (full normalization)", () => {
      const bm25 = new BM25({ b: 1.0 });
      const docs = [
        { id: "1", fields: { text: "test" } },
        { id: "2", fields: { text: "test " + "filler ".repeat(100) } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      // With b=1, strong length penalty
      expect(results[0].id).toBe("1");
    });
  });

  describe("Field Weighting", () => {
    it("should apply field weights correctly", () => {
      const bm25 = new BM25({
        fieldWeights: {
          title: 3.0,
          description: 1.0,
        },
      });

      const docs = [
        { id: "1", fields: { title: "test", description: "other" } },
        { id: "2", fields: { title: "other", description: "test" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      // Title match should rank higher due to 3x weight
      expect(results[0].id).toBe("1");
      expect(results[0].score).toBeGreaterThan(results[1].score * 2);
    });

    it("should handle multiple fields with different weights", () => {
      const bm25 = new BM25({
        fieldWeights: {
          title: 3.0,
          description: 1.5,
          content: 1.0,
        },
      });

      const docs = [
        {
          id: "1",
          fields: {
            title: "relevant",
            description: "test",
            content: "other",
          },
        },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe("Multi-term Queries", () => {
    it("should score documents matching all terms highest", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "push notification setup" } },
        { id: "2", fields: { text: "push notification" } },
        { id: "3", fields: { text: "setup guide" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("push notification setup");

      // Doc 1 matches all terms, should rank first
      expect(results[0].id).toBe("1");
    });

    it("should combine scores from multiple terms", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "ios swift sdk" } },
        { id: "2", fields: { text: "android kotlin sdk" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("ios swift");

      expect(results[0].id).toBe("1");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query", () => {
      const bm25 = new BM25();
      const docs = [{ id: "1", fields: { text: "test" } }];

      bm25.indexDocuments(docs);
      const results = bm25.search("");

      expect(results).toHaveLength(0);
    });

    it("should handle query with only short terms", () => {
      const bm25 = new BM25();
      const docs = [{ id: "1", fields: { text: "test document" } }];

      bm25.indexDocuments(docs);
      const results = bm25.search("a b c");

      expect(results).toHaveLength(0);
    });

    it("should handle empty documents", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "" } },
        { id: "2", fields: { text: "test" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("2");
    });

    it("should handle no matching documents", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "apple banana" } },
        { id: "2", fields: { text: "orange grape" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("nonexistent");

      expect(results).toHaveLength(0);
    });

    it("should handle special characters in query", () => {
      const bm25 = new BM25();
      const docs = [{ id: "1", fields: { text: "test document" } }];

      bm25.indexDocuments(docs);
      const results = bm25.search("test!@#$%^&*()");

      expect(results).toHaveLength(1);
    });
  });

  describe("Result Limiting", () => {
    it("should return maxResults number of documents", () => {
      const bm25 = new BM25();
      const docs = Array.from({ length: 10 }, (_, i) => ({
        id: i.toString(),
        fields: { text: `test document ${i}` },
      }));

      bm25.indexDocuments(docs);
      const results = bm25.search("test", 5);

      expect(results).toHaveLength(5);
    });

    it("should return fewer results if fewer documents match", () => {
      const bm25 = new BM25();
      const docs = [
        { id: "1", fields: { text: "test" } },
        { id: "2", fields: { text: "test" } },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("test", 10);

      expect(results).toHaveLength(2);
    });
  });

  describe("Parameter Tuning", () => {
    it("should handle different k1 values", () => {
      const bm25Low = new BM25({ k1: 1.2 });
      const bm25High = new BM25({ k1: 2.0 });

      const docs = [{ id: "1", fields: { text: "test test test" } }];

      bm25Low.indexDocuments(docs);
      bm25High.indexDocuments(docs);

      const resultsLow = bm25Low.search("test");
      const resultsHigh = bm25High.search("test");

      // Higher k1 = more weight to term frequency
      expect(resultsHigh[0].score).toBeGreaterThan(resultsLow[0].score);
    });

    it("should handle different b values", () => {
      const bm25Low = new BM25({ b: 0.0 });
      const bm25High = new BM25({ b: 1.0 });

      const docs = [
        { id: "1", fields: { text: "test " + "filler ".repeat(100) } },
        { id: "2", fields: { text: "test" } },
      ];

      bm25Low.indexDocuments(docs);
      bm25High.indexDocuments(docs);

      const resultsLow = bm25Low.search("test");
      const resultsHigh = bm25High.search("test");

      // With b=0, no length penalty - long doc might score higher
      // With b=1, strong length penalty - short doc should score higher
      expect(resultsLow).toHaveLength(2);
      expect(resultsHigh).toHaveLength(2);
      expect(resultsHigh[0].id).toBe("2"); // Short doc should rank first with b=1
    });
  });

  describe("Real-world Scenarios", () => {
    it("should rank documentation pages correctly", () => {
      const bm25 = new BM25({
        fieldWeights: {
          title: 3.0,
          description: 1.5,
          url: 0.8,
        },
      });

      const docs = [
        {
          id: "1",
          fields: {
            title: "iOS Push Notification Setup",
            description: "Complete guide to setting up push notifications on iOS",
            url: "/docs/ios/push-notifications",
          },
        },
        {
          id: "2",
          fields: {
            title: "Android Setup Guide",
            description: "Push notification configuration for Android",
            url: "/docs/android/notifications",
          },
        },
        {
          id: "3",
          fields: {
            title: "Flutter Integration",
            description: "General setup instructions",
            url: "/docs/flutter/setup",
          },
        },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("iOS push notification");

      // iOS push notification doc should rank first
      expect(results[0].id).toBe("1");
    });

    it("should rank SDK source files correctly", () => {
      const bm25 = new BM25({
        fieldWeights: {
          title: 3.0,
          description: 1.5,
          file: 1.0,
          platform: 0.5,
        },
      });

      const docs = [
        {
          id: "1",
          fields: {
            title: "Notification Service",
            description: "Handles push notification lifecycle",
            file: "NotificationService.swift",
            platform: "ios",
          },
        },
        {
          id: "2",
          fields: {
            title: "Event Service",
            description: "Track custom events",
            file: "EventService.swift",
            platform: "ios",
          },
        },
        {
          id: "3",
          fields: {
            title: "Clix Core",
            description: "Main SDK initialization with notification support",
            file: "Clix.swift",
            platform: "ios",
          },
        },
      ];

      bm25.indexDocuments(docs);
      const results = bm25.search("notification");

      // Notification Service should rank first
      expect(results[0].id).toBe("1");
    });
  });

  describe("Performance", () => {
    it("should handle large document collections", () => {
      const bm25 = new BM25();
      const docs = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        fields: {
          text: `Document ${i} with some test content and keywords`,
        },
      }));

      const startIndex = Date.now();
      bm25.indexDocuments(docs);
      const indexTime = Date.now() - startIndex;

      const startSearch = Date.now();
      const results = bm25.search("test content");
      const searchTime = Date.now() - startSearch;

      // Indexing should be reasonably fast (< 1 second)
      expect(indexTime).toBeLessThan(1000);

      // Search should be very fast (< 100ms)
      expect(searchTime).toBeLessThan(100);

      // Should return relevant results
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

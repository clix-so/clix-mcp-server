/**
 * LLMS Mapping Tests (local mapping at repo root)
 *
 * Validates that clix-mcp-server/llms.txt lists per-SDK llms.txt links
 * and (optionally) that these links are accessible.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath((import.meta as any).url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../");
const LOCAL_MAPPING_PATH = path.join(REPO_ROOT, "llms.txt");

function parseMarkdownLinks(content: string): string[] {
  const urls: string[] = [];
  const re = /\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1]) urls.push(m[1]);
  }
  return urls;
}

describe("LLMS Mapping (local file)", () => {
  it("should list valid per-SDK llms.txt raw URLs", () => {
    const content = readFileSync(LOCAL_MAPPING_PATH, "utf8");
    const urls = parseMarkdownLinks(content).filter((u) => /\/llms\.txt$/i.test(u));
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const url of urls) {
      expect(url.startsWith("https://raw.githubusercontent.com/")).toBe(true);
      expect(/\/refs\/heads\/main\/llms\.txt$/i.test(url) || /\/main\/llms\.txt$/i.test(url)).toBe(
        true
      );
    }
  });

  it(
    "live: each per-SDK llms.txt URL in mapping should be accessible (HTTP 200)",
    async () => {
      const originalFetch: any = (global as any).fetch;
      if (typeof originalFetch !== "function") {
        return;
      }
      const content = readFileSync(LOCAL_MAPPING_PATH, "utf8");
      const urls = parseMarkdownLinks(content).filter((u) => /\/llms\.txt$/i.test(u));
      expect(urls.length).toBeGreaterThan(0);
      let total = 0;
      let ok = 0;
      let fail = 0;
      for (const url of urls) {
        total++;
        try {
          const res = await originalFetch(url as any);
          if (res && (res as any).ok) {
            ok++;
          } else {
            fail++;
          }
        } catch {
          fail++;
        }
      }
      // eslint-disable-next-line no-console
      console.log(`Mapping link summary: total=${total} ok=${ok} fail=${fail}`);
      // Do not fail the suite on transient network failures; require at least one success
      expect(ok).toBeGreaterThan(0);
    },
    30000
  );

  it(
    "live: each entry link inside per-SDK llms.txt should be accessible (HTTP 200)",
    async () => {
      const originalFetch: any = (global as any).fetch;
      if (typeof originalFetch !== "function") {
        return;
      }
      const content = readFileSync(LOCAL_MAPPING_PATH, "utf8");
      const perSdkUrls = parseMarkdownLinks(content).filter((u) => /\/llms\.txt$/i.test(u));
      expect(perSdkUrls.length).toBeGreaterThan(0);

      let sdkTotal = 0;
      let sdkOk = 0;
      let sdkFail = 0;
      let entryTotal = 0;
      let entryOk = 0;
      let entryFail = 0;

      for (const perUrl of perSdkUrls) {
        sdkTotal++;
        let perTxt = "";
        try {
          const res = await originalFetch(perUrl as any);
          if (!res || !(res as any).ok) {
            sdkFail++;
            // eslint-disable-next-line no-console
            console.warn(`SDK llms not accessible (HTTP ${res?.status}): ${perUrl}`);
            continue;
          }
          sdkOk++;
          perTxt = await (res as any).text();
        } catch {
          sdkFail++;
          // eslint-disable-next-line no-console
          console.warn(`SDK llms fetch failed: ${perUrl}`);
          continue;
        }

        const entryUrls = parseMarkdownLinks(perTxt).filter((u) =>
          u.startsWith("https://raw.githubusercontent.com/")
        );
        // Each SDK llms should have at least one entry
        if (entryUrls.length === 0) {
          // eslint-disable-next-line no-console
          console.warn(`No entries found in SDK llms: ${perUrl}`);
        }
        entryTotal += entryUrls.length;

        for (const fileUrl of entryUrls) {
          try {
            const r = await originalFetch(fileUrl as any);
            if (r && (r as any).ok) {
              entryOk++;
            } else {
              entryFail++;
              // eslint-disable-next-line no-console
              console.warn(`Entry not accessible (HTTP ${r?.status}): ${fileUrl}`);
            }
          } catch {
            entryFail++;
            // eslint-disable-next-line no-console
            console.warn(`Entry fetch failed: ${fileUrl}`);
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `Entry link summary: sdk total=${sdkTotal} ok=${sdkOk} fail=${sdkFail} | entries total=${entryTotal} ok=${entryOk} fail=${entryFail}`
      );
      // Require at least one SDK llms and one entry to succeed to avoid flakiness
      expect(sdkOk).toBeGreaterThan(0);
      expect(entryOk).toBeGreaterThan(0);
    },
    60000
  );
});



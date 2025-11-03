import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"], // Test files in test/ directory
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/resources/**", // Exclude reference materials
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["node_modules/", "dist/", "**/*.test.ts", "scripts/", "resources/", "test/"],
    },
  },
});

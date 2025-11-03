# Contributing to Clix MCP Server

Thank you for your interest in contributing to Clix MCP Server! This document
provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or pnpm
- Git

### Setup Development Environment

1. **Fork and Clone**

```bash
git clone https://github.com/YOUR_USERNAME/clix-mcp-server.git
cd clix-mcp-server
```

2. **Install Dependencies**

```bash
npm install
```

3. **Build the Project**

```bash
npm run build
```

4. **Run Tests**

```bash
npm test
```

## Development Workflow

### Code Style

We use Prettier for code formatting:

```bash
# Check formatting
npm run lint

# Fix formatting
npm run lint:fix
```

### Making Changes

1. **Create a Branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code patterns
   - Add tests for new features
   - Update documentation as needed

3. **Test Your Changes**

```bash
npm run typecheck  # Check TypeScript types
npm test          # Run tests
npm run build     # Ensure it builds
```

4. **Commit Your Changes**

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add new tool for user segmentation"
git commit -m "fix: handle API timeout errors gracefully"
git commit -m "docs: update README with new configuration options"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

## Adding New Tools

To add a new MCP tool:

1. **Create Tool File**

Create `src/tools/your-tool.ts`:

```typescript
import { z } from "zod";
import type { ToolDefinition, ServerContext } from "../types.js";

const yourToolInputSchema = z.object({
  param: z.string().describe("Parameter description"),
});

type YourToolInput = z.infer<typeof yourToolInputSchema>;

export const yourTool: ToolDefinition<YourToolInput, string> = {
  name: "your_tool",
  description: "Detailed tool description",
  inputSchema: {
    param: yourToolInputSchema.shape.param,
  },
  async handler(
    params: YourToolInput,
    context: ServerContext
  ): Promise<string> {
    // Implementation
    return "Result";
  },
};
```

2. **Register Tool**

Add to `src/tools/index.ts`:

```typescript
export { yourTool } from "./your-tool.js";

export const MCP_TOOLS = {
  // ... existing tools
  your_tool: yourTool,
} as const;
```

3. **Add Tests**

Create `src/tools/your-tool.test.ts`.

4. **Update Documentation**

Add tool documentation to README.md.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run type checking
npm run typecheck
```

### Writing Tests

Place tests next to the code they test:

```text
src/
├── tools/
│   ├── your-tool.ts
│   └── your-tool.test.ts
```

## Pull Request Process

1. **Update Documentation**
   - Update README.md if needed
   - Add JSDoc comments to new functions
   - Update CHANGELOG.md (if exists)

2. **Ensure Quality**
   - All tests pass
   - Code is formatted
   - Types are correct
   - No linting errors

3. **Create Pull Request**
   - Use a clear, descriptive title
   - Describe what changed and why
   - Reference related issues
   - Add screenshots/examples if applicable

4. **Code Review**
   - Address reviewer feedback
   - Keep discussions constructive
   - Update PR as needed

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Accept responsibility for mistakes

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Publishing private information
- Any unprofessional conduct

## Questions?

- **Issues**: [GitHub Issues](https://github.com/clix-so/clix-mcp-server/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/clix-so/clix-mcp-server/discussions)
- **Community**: [Clix Community](https://community.clix.so)

## License

By contributing, you agree that your contributions will be licensed under the
MIT License with Custom Restrictions.

---

Thank you for contributing to Clix MCP Server! 🎉

# Clix MCP Server

Clix MCP Server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), an open-source standard that allows large language models to interact with external tools and data sources.

It provides two developer‑focused tools that keep you in flow while integrating Clix:

- **Documentation Search** — Search across Clix documentation: user guides, API reference, troubleshooting, and best practices.
- **SDK Search** — Search across Clix SDKs (iOS, Android, Flutter, React Native) and integration examples. Discover SDK symbols (types, methods, parameters) and retrieve production‑ready snippets.

## Installation

### Prerequisites

- Node.js >= 18

### Quick Start

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "clix": {
      "command": "npx",
      "args": ["-y", "@clix-so/clix-mcp-server@latest"]
    }
  }
}
```

Restart your MCP client to load the configuration.

## Available Tools

| Tool        | Command       | Description                                        |
| ----------- | ------------- | -------------------------------------------------- |
| Docs Search | `search_docs` | Semantic search across official Clix documentation |
| SDK Search  | `search_sdk`  | Search SDK source code and implementation examples |

## Command-Line Options

```bash
clix-mcp-server [options]

--version, -v  Show version
--help, -h     Show help
```

## Development

### Local Setup

```bash
# Clone and install
git clone https://github.com/clix-so/clix-mcp-server.git
cd clix-mcp-server
npm install

# Build
npm run build

# Run tests
npm test

# Development mode (watch for changes)
npm run dev
```

### MCP Client Configuration for Local Development

Before the package is published, configure your MCP client to use the local
build:

```json
{
  "mcpServers": {
    "clix": {
      "command": "node",
      "args": ["/absolute/path/to/clix-mcp-server/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/clix-mcp-server` with your actual project path.

## License

MIT License with Custom Restrictions - see [LICENSE](LICENSE) for details.

## Resources

- [Documentation](https://docs.clix.so)
- [GitHub Issues](https://github.com/clix-so/clix-mcp-server/issues)
- [Clix Dashboard](https://console.clix.so/)

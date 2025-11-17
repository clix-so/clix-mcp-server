export const DOCS_SEARCH_DESCRIPTION = `Intelligent Documentation Search - Semantic search across official Clix documentation.

**Overview:**
Performs semantic search on the official Clix documentation index (llms.txt). Returns actual documentation content with relevant context for SDK integration, configuration, and troubleshooting.

**Use Cases:**
- SDK setup and initialization guides (iOS, Android, Flutter, React Native)
- Push notification and in-app message configuration
- API reference and integration patterns
- Platform-specific implementation details
- Troubleshooting SDK integration issues
- Best practices and recommended workflows
- User segmentation and analytics setup

**Returns:**
- Fetched documentation content (not just links)
- Relevant excerpts with context
- Source URLs for further reference
- Ranked by relevance score

**Parameters:**
- \`query\` (required): Natural language search query (2-200 characters)
- \`maxResults\` (optional): Number of results to return (1-10, default: 3)

**Example:**
\`\`\`
search_docs({ 
  query: "iOS push notification setup with APNs certificate", 
  maxResults: 5 
})
\`\`\``;

export const SDK_SEARCH_DESCRIPTION = `SDK Source Code Search - Search Clix SDK source code across iOS (Swift), Android (Kotlin), Flutter (Dart), and React Native (TypeScript) platforms.

**Overview:**
Intelligently searches Clix SDK source code repositories. Fetches actual implementation code with relevant context for development, debugging, and integration.

**Use Cases:**
- Find specific SDK methods and class implementations
- Understand SDK architecture and design patterns
- Locate platform-specific features and APIs
- Debug SDK integration issues with actual source code
- Learn best practices from production implementations
- Compare implementations across platforms
- Reference API signatures and method parameters

**Platform Coverage:**
- **iOS SDK (Swift)**: Core modules, Services, Models, Utilities, Extensions
- **Android SDK (Kotlin)**: Core modules, Services, Models, Utilities, Managers
- **Flutter SDK (Dart)**: Core modules, Services, Models, Platform channels, Widgets
- **React Native SDK (TypeScript)**: Core modules, Services, Models, Native bridges, Utilities

**Returns:**
- Actual source code fetched from GitHub
- File metadata (platform, path, description)
- Ranked by relevance to query
- Syntax-highlighted code blocks
- Direct GitHub repository links

**Parameters:**
- \`query\` (required): Code-focused search query (2-200 characters)
- \`platform\` (optional): Filter by platform (\`ios\`, \`android\`, \`flutter\`, \`react-native\`, \`all\`)
- \`maxResults\` (optional): Number of results to return (1-10, default: 3)

**Example:**
\`\`\`
search_sdk({ 
  query: "notification service extension implementation", 
  platform: "ios",
  maxResults: 3
})
\`\`\``;

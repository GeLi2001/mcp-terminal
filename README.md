# MCP Terminal

A terminal-based interactive client for Model Context Protocol (MCP) servers.

## Installation

```bash
npm install -g mcp-terminal
```

## Features

- Connect to multiple MCP servers simultaneously
- Interactive terminal for sending messages to models
- Easy configuration management
- Support for both stdio and SSE transports
- Switch between connected servers

## Configuration

Before using MCP CLI, you need to configure at least one server:

```bash
mcp-terminal configure
```

This will open your default editor with a configuration file where you can define MCP servers.

Example configuration:

```json
{
  "mcpServers": {
    "local-sse": {
      "command": "npx @anthropic-ai/mcp-server@latest",
      "args": [],
      "url": "http://localhost:8765/sse"
    },
    "local-stdio": {
      "command": "npx @anthropic-ai/mcp-server@latest",
      "args": ["--stdio"]
    },
    "shopify": {
      "command": "npx",
      "args": [
        "shopify-mcp",
        "--accessToken",
        "your-shopify-access-token",
        "--domain",
        "your-store.myshopify.com"
      ]
    }
  }
}
```

Notice that servers can be configured with:

- Both `command` and `url` for servers that need to be started locally but use SSE transport
- Just `command` for servers that use stdio transport
- Just `url` for connecting to remote servers

## Usage

### Configure MCP servers

```bash
mcp-terminal configure
```

This will open your default editor to configure MCP servers.

### Start MCP server

```bash
mcp-terminal start
```

This will start the configured MCP server. You can have multiple servers configured.

### Interactive Chat with AI using MCP tools

```bash
mcp-terminal chat
```

This starts an interactive chat session with an AI model that can use MCP tools from your configured server. The LLM can interact with the MCP server tools to help answer your questions and perform actions.

You can specify which server to use:

```bash
mcp-terminal chat -s local-stdio
```

#### Server Types

The chat command supports two types of server configurations:

1. **URL-based servers** - Servers with a URL configured will connect via HTTP/SSE
2. **Command-based servers** - Servers with only a command will be started automatically and use stdio transport

#### Requirements

To use the chat feature, you need:

1. An OpenAI API key (set as `OPENAI_API_KEY` environment variable or in a `.env` file)
2. A configured MCP server (configure using `mcp-terminal configure`)

#### Example usage

```
$ mcp-terminal chat
Starting chat session with LLM...
Type 'exit' or 'quit' to end the session.

Using MCP server: local-stdio
Starting MCP server: local-stdio
Server is running...
Connected to MCP server via stdio transport

You: What's the weather in New York today?
AI is thinking...
AI: I'd like to check the weather in New York for you, but I need to use a tool to get that information.

I attempted to use a weather tool, but we're currently connected via stdio transport, which doesn't allow me to directly access external tools. In a full implementation with the appropriate tools configured, I would be able to fetch real-time weather data for New York.

To get the actual weather in New York today, you could:
1. Use a different MCP server configured with HTTP/SSE transport and weather tools
2. Check a weather website or app directly
3. Ask me a different question I can answer without external tools

Can I help you with something else?

You: What is MCP?
AI is thinking...
AI: MCP stands for Model Context Protocol. It's an open standard protocol designed to connect AI language models (LLMs) like me with external tools, data sources, and APIs.

Here's what makes MCP important:

1. It allows AI models to extend their capabilities beyond their training data by accessing external tools and real-time information.

2. It provides a standardized way for developers to create tools that AI models can interact with, making integration simpler.

3. It enables AI assistants to perform actions in the real world - things like searching the web, accessing databases, running code, or interacting with services like the weather example you asked about earlier.

4. It can work through different transport methods, such as HTTP/SSE (Server-Sent Events) or stdio (standard input/output), depending on the implementation.

The MCP-terminal tool you're using right now is a client that helps manage MCP servers and facilitates communication between users, AI models, and the tools provided by those servers.

You: exit

## License

MIT
```

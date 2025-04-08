import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import chalk from "chalk";
import { ChildProcess } from "child_process";
import { configManager } from "../config/configManager.js";

// Define interfaces for MCP tools and responses
interface McpTool {
  name: string;
  description?: string;
  parameters?: any; // This will store the full parameter schema
}

export class McpConnection {
  private client: Client | null = null;
  private childProcess: ChildProcess | null = null;
  private serverName: string;

  constructor(serverName: string) {
    this.serverName = serverName;
  }

  async connect(): Promise<{ success: boolean; message: string }> {
    const serverConfig = configManager.getServer(this.serverName);

    if (!serverConfig) {
      return {
        success: false,
        message: `Server "${this.serverName}" not found in configuration`
      };
    }

    try {
      // Check if it's a stdio-based server (has command)
      if (serverConfig.command && !serverConfig.url) {
        // Create a stdio transport with environment variables
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: {
            // Filter out undefined values by converting process.env to a clean object
            ...Object.entries(process.env).reduce((acc, [key, value]) => {
              if (value !== undefined) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
            ...(serverConfig.env || {})
          }
        });

        // Create the client
        this.client = new Client(
          {
            name: `mcp-terminal-client-${this.serverName}`,
            version: "1.0.0"
          },
          {
            capabilities: {
              resources: true,
              tools: true,
              prompts: true
            }
          }
        );

        // Connect to the transport
        await this.client.connect(transport);

        // Store a reference to the underlying child process if needed for cleanup
        // @ts-ignore - accessing private property
        this.childProcess = transport._process;

        return {
          success: true,
          message: `Connected to ${this.serverName} via stdio`
        };
      }
      // Check if it's an SSE-based server (has URL)
      else if (serverConfig.url) {
        // Create an SSE transport
        const transport = new SSEClientTransport(new URL(serverConfig.url));

        // Create the client
        this.client = new Client(
          {
            name: `mcp-terminal-client-${this.serverName}`,
            version: "1.0.0"
          },
          {
            capabilities: {
              resources: true,
              tools: true,
              prompts: true
            }
          }
        );

        // Connect to the transport
        await this.client.connect(transport);

        return {
          success: true,
          message: `Connected to ${this.serverName} via SSE`
        };
      } else {
        return {
          success: false,
          message: `Server configuration for ${this.serverName} is missing required parameters`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to connect to ${this.serverName}: ${error.message}`
      };
    }
  }

  getClient(): Client | null {
    return this.client;
  }

  getServerName(): string {
    return this.serverName;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  async listResources(): Promise<{ uri: string; name: string }[] | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.listResources();
      return response.resources;
    } catch (error) {
      // Don't log method-not-found errors as they're expected with some servers
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === -32601
      ) {
        return null;
      }
      console.error(chalk.red("Error listing resources:"), error);
      return null;
    }
  }

  async listTools(): Promise<McpTool[] | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.listTools();
      // console.log("Raw MCP tool response:", JSON.stringify(response, null, 2));

      // Return the full tool schema including parameters
      return response.tools.map((tool: any) => {
        // Extract all properties including parameters
        const toolData: McpTool = {
          name: tool.name,
          description: tool.description || ""
        };

        // Use inputSchema as parameters if available (this is the key fix)
        if (tool.inputSchema) {
          toolData.parameters = tool.inputSchema;
        } else if (tool.parameters) {
          toolData.parameters = tool.parameters;
        } else {
          // Default parameters schema
          toolData.parameters = {
            type: "object",
            properties: {}
          };
        }

        return toolData;
      });
    } catch (error) {
      // Don't log method-not-found errors as they're expected with some servers
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === -32601
      ) {
        return null;
      }
      console.error(chalk.red("Error listing tools:"), error);
      return null;
    }
  }

  /**
   * Call a tool on the MCP server
   * @param toolName The name of the tool to call
   * @param args The arguments to pass to the tool
   * @returns The result of the tool call, or null if the call failed
   */
  async callTool(toolName: string, args: any): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client is not connected");
    }

    try {
      console.log(
        `Calling MCP tool ${toolName} with args:`,
        JSON.stringify(args, null, 2)
      );

      // Call the tool through the MCP client
      const result = await this.client.callTool({
        name: toolName,
        arguments: args
      });

      // console.log(`Tool ${toolName} result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(chalk.red(`Error calling tool ${toolName}:`), error);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === -32601
      ) {
        throw new Error(
          `Tool ${toolName} not found on server ${this.serverName}`
        );
      }
      throw error;
    }
  }
}

// Function to get a connection to all available servers
export async function connectToAllServers(): Promise<McpConnection[]> {
  const servers = configManager.getServers();
  const serverNames = Object.keys(servers);

  if (serverNames.length === 0) {
    console.error(chalk.red("No servers configured."));
    console.error(
      chalk.yellow('Run "mcp-terminal configure" to set up servers.')
    );
    return [];
  }

  console.log(chalk.blue(`Starting ${serverNames.length} servers...`));

  const connections: McpConnection[] = [];

  for (const serverName of serverNames) {
    console.log(chalk.blue(`Connecting to server: ${chalk.bold(serverName)}`));
    const connection = new McpConnection(serverName);
    const result = await connection.connect();

    if (result.success) {
      console.log(chalk.green(result.message));
      connections.push(connection);
    } else {
      console.error(chalk.red(result.message));
    }
  }

  return connections;
}

// Function to get a connection to the specified server
export async function connectToServer(
  serverName?: string
): Promise<McpConnection | null> {
  let targetServer: string;

  if (serverName) {
    // Use the specified server
    targetServer = serverName;

    // Check if the specified server exists
    if (!configManager.getServer(targetServer)) {
      console.error(
        chalk.red(`Server "${targetServer}" not found in configuration.`)
      );
      console.error(
        chalk.yellow('Run "mcp-terminal configure" to set up servers.')
      );
      return null;
    }
  } else {
    // Use the first available server if none specified
    const firstServer = configManager.getFirstServer();

    if (!firstServer) {
      console.error(
        chalk.red("No servers configured and no server specified.")
      );
      console.error(
        chalk.yellow('Run "mcp-terminal configure" to set up servers.')
      );
      return null;
    }

    targetServer = firstServer.name;
    console.log(chalk.blue(`Using server: ${chalk.bold(targetServer)}`));
  }

  const connection = new McpConnection(targetServer);
  const result = await connection.connect();

  if (result.success) {
    console.log(chalk.green(result.message));
    return connection;
  } else {
    console.error(chalk.red(result.message));
    return null;
  }
}

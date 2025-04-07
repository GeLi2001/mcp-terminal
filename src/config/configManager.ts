import Conf from "conf";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

interface ServerConfig {
  command: string;
  args?: string[];
  url?: string;
  capabilities?: {
    resources?: boolean;
    tools?: boolean;
    prompts?: boolean;
  };
}

interface McpConfig {
  defaultModel?: string;
  mcpServers: Record<string, ServerConfig>;
}

class ConfigManager {
  private config;
  private configFilePath: string;

  constructor() {
    // Initialize configuration using Conf constructor properly
    this.config = new (Conf as any)({
      projectName: "mcp-terminal",
      schema: {
        defaultModel: {
          type: ["string", "null"]
        },
        mcpServers: {
          type: "object",
          default: {}
        }
      }
    });

    // Create custom config path for .mcp
    this.configFilePath = path.join(os.homedir(), ".mcp", "config.json");
    this.ensureConfigExists();
  }

  // Ensure the .mcp directory and config file exist
  private ensureConfigExists(): void {
    const configDir = path.dirname(this.configFilePath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configFilePath)) {
      // Create an empty config file
      fs.writeFileSync(
        this.configFilePath,
        JSON.stringify({ mcpServers: {} }, null, 2),
        "utf-8"
      );
    }
  }

  // Get the path to the .mcp config file
  getConfigFilePath(): string {
    return this.configFilePath;
  }

  // Add or update a server configuration
  addServer(name: string, serverConfig: ServerConfig): void {
    const config = this.loadMcpConfig();
    config.mcpServers[name] = serverConfig;
    this.saveMcpConfig(config);
  }

  // Remove a server configuration
  removeServer(name: string): boolean {
    const config = this.loadMcpConfig();

    if (config.mcpServers[name]) {
      delete config.mcpServers[name];
      this.saveMcpConfig(config);
      return true;
    }

    return false;
  }

  // Set the default model
  setDefaultModel(model: string): void {
    const config = this.loadMcpConfig();
    config.defaultModel = model;
    this.saveMcpConfig(config);
  }

  // Get all server configurations
  getServers(): Record<string, ServerConfig> {
    return this.loadMcpConfig().mcpServers;
  }

  // Get a specific server configuration
  getServer(name: string): ServerConfig | undefined {
    return this.loadMcpConfig().mcpServers[name];
  }

  // Get the first available server (if any)
  getFirstServer(): { name: string; config: ServerConfig } | undefined {
    const config = this.loadMcpConfig();
    const serverNames = Object.keys(config.mcpServers);

    if (serverNames.length > 0) {
      return {
        name: serverNames[0],
        config: config.mcpServers[serverNames[0]]
      };
    }

    return undefined;
  }

  // Get the default model
  getDefaultModel(): string | undefined {
    return this.loadMcpConfig().defaultModel;
  }

  // Load configuration from the .mcp config file
  private loadMcpConfig(): McpConfig {
    try {
      const fileContent = fs.readFileSync(this.configFilePath, "utf-8");
      return JSON.parse(fileContent);
    } catch (error) {
      // Return a default config if there's an error reading the file
      return { mcpServers: {} };
    }
  }

  // Save configuration to the .mcp config file
  private saveMcpConfig(config: McpConfig): void {
    fs.writeFileSync(
      this.configFilePath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );
  }
}

// Export a singleton instance
export const configManager = new ConfigManager();

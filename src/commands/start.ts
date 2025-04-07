import chalk from "chalk";
import { Command } from "commander";
import * as readline from "readline";
import { configManager } from "../config/configManager.js";
import {
  connectToAllServers,
  connectToServer,
  McpConnection
} from "../utils/mcpConnection.js";

export function startCommand(program: Command): void {
  program
    .command("start")
    .description("Start an interactive terminal session with MCP servers")
    .option("-m, --model <modelId>", "Model ID to use for the session")
    .option(
      "-s, --server <serverName>",
      "Optional server to connect to (if not provided, all servers will be started)"
    )
    .action(async (options) => {
      const modelId = options.model || configManager.getDefaultModel();

      if (!modelId) {
        console.error(
          chalk.red("No model specified and no default model configured.")
        );
        console.error(
          chalk.yellow(
            "Please specify a model with --model or set a default model."
          )
        );
        process.exit(1);
      }

      console.log(
        chalk.blue(`Starting MCP terminal with model: ${chalk.bold(modelId)}`)
      );

      // Get a connection to either the specified server or all servers
      let connection: McpConnection | null = null;
      let allConnections: McpConnection[] = [];

      if (options.server) {
        // Connect to a specific server
        connection = await connectToServer(options.server);
        if (!connection) {
          process.exit(1);
        }
        allConnections = [connection];
      } else {
        // Connect to all available servers
        allConnections = await connectToAllServers();
        if (allConnections.length === 0) {
          console.error(chalk.red("No servers could be started."));
          process.exit(1);
        }
        // Use the first connection as the primary one
        connection = allConnections[0];
      }

      const client = connection.getClient();

      if (!client) {
        console.error(chalk.red("Failed to get MCP client."));
        process.exit(1);
      }

      // Set up readline interface
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green("> "),
        terminal: true
      });

      // Display welcome message
      console.log(chalk.bold.green("\nMCP Terminal - Interactive Session"));
      console.log(
        chalk.yellow("Type your messages to interact with the server.")
      );
      console.log(chalk.yellow("Type /help for available commands."));
      console.log(chalk.yellow("Type /exit to quit.\n"));

      // Check for available resources
      const resources = await connection?.listResources();
      if (resources && resources.length > 0) {
        console.log(chalk.blue("Available resources:"));
        resources.forEach((resource) => {
          console.log(
            `  ${chalk.green(resource.name)} (${chalk.yellow(resource.uri)})`
          );
        });
        console.log();
      }

      // Check for available tools
      const tools = await connection?.listTools();
      if (tools && tools.length > 0) {
        console.log(chalk.blue("Available tools:"));
        tools.forEach((tool) => {
          console.log(`  ${chalk.green(tool.name)}: ${tool.description}`);
        });
        console.log();
      }

      rl.prompt();

      rl.on("line", async (line) => {
        const input = line.trim();

        // Handle special commands
        if (input === "/exit") {
          console.log(chalk.yellow("Exiting MCP terminal..."));
          // Disconnect from all connections
          for (const conn of allConnections) {
            await conn.disconnect();
          }
          rl.close();
          return;
        }

        if (input === "/help") {
          console.log(chalk.blue("Available commands:"));
          console.log(`  ${chalk.green("/exit")} - Exit the terminal`);
          console.log(`  ${chalk.green("/help")} - Display this help message`);
          console.log(
            `  ${chalk.green("/resources")} - List available resources`
          );
          console.log(`  ${chalk.green("/tools")} - List available tools`);
          console.log(
            `  ${chalk.green(
              "/servers"
            )} - List and switch between connected servers`
          );
          rl.prompt();
          return;
        }

        if (input === "/servers") {
          if (allConnections.length > 1) {
            console.log(chalk.blue("Connected servers:"));
            allConnections.forEach((conn, index) => {
              const isActive = conn === connection;
              console.log(
                `  ${isActive ? chalk.green("→") : " "} ${
                  index + 1
                }. ${chalk.bold(conn.getServerName())}`
              );
            });
            console.log(
              chalk.yellow("\nTo switch servers, type /use <number>")
            );
          } else if (allConnections.length === 1) {
            console.log(chalk.blue("Connected to server:"));
            console.log(
              `  ${chalk.green("→")} 1. ${chalk.bold(
                allConnections[0].getServerName()
              )}`
            );
          } else {
            console.log(chalk.yellow("No servers connected."));
          }
          rl.prompt();
          return;
        }

        // Handle server switching
        if (input.startsWith("/use ")) {
          const serverIndex = parseInt(input.substring(5).trim(), 10) - 1;
          if (
            isNaN(serverIndex) ||
            serverIndex < 0 ||
            serverIndex >= allConnections.length
          ) {
            console.log(
              chalk.red(
                "Invalid server number. Use /servers to see available servers."
              )
            );
          } else {
            connection = allConnections[serverIndex];
            console.log(
              chalk.green(
                `Switched to server: ${chalk.bold(connection.getServerName())}`
              )
            );

            // Show available tools for the new server
            const tools = await connection?.listTools();
            if (tools && tools.length > 0) {
              console.log(chalk.blue("Available tools:"));
              tools.forEach((tool) => {
                console.log(`  ${chalk.green(tool.name)}: ${tool.description}`);
              });
            }
          }
          rl.prompt();
          return;
        }

        if (input === "/resources") {
          const resources = await connection?.listResources();
          if (resources && resources.length > 0) {
            console.log(chalk.blue("Available resources:"));
            resources.forEach((resource) => {
              console.log(
                `  ${chalk.green(resource.name)} (${chalk.yellow(
                  resource.uri
                )})`
              );
            });
          } else {
            console.log(chalk.yellow("No resources available."));
          }
          rl.prompt();
          return;
        }

        if (input === "/tools") {
          const tools = await connection?.listTools();
          if (tools && tools.length > 0) {
            console.log(chalk.blue("Available tools:"));
            tools.forEach((tool) => {
              console.log(`  ${chalk.green(tool.name)}: ${tool.description}`);
            });
          } else {
            console.log(chalk.yellow("No tools available."));
          }
          rl.prompt();
          return;
        }

        // Regular message - send to the server
        if (input) {
          try {
            // TODO: Implement actual communication with the MCP server
            // For now, just echo the message back
            console.log(chalk.dim("Sending message..."));

            if (!connection) {
              console.error(chalk.red("No active server connection."));
              rl.prompt();
              return;
            }

            const serverName = connection.getServerName();

            // This is a placeholder for actual MCP communication
            // In a real implementation, we would send the message to the MCP server
            // and display the response
            setTimeout(() => {
              console.log(
                chalk.blue(
                  `[${serverName}/${modelId}]: I received your message: "${input}"`
                )
              );
              console.log(
                chalk.blue(
                  `[${serverName}/${modelId}]: This is a placeholder response. In a real implementation, this would be a response from the model.`
                )
              );
              rl.prompt();
            }, 500);
          } catch (error: any) {
            console.error(chalk.red("Error:"), error.message);
            rl.prompt();
          }
        } else {
          rl.prompt();
        }
      });

      rl.on("close", async () => {
        console.log(chalk.yellow("MCP terminal session ended."));
        // Disconnect from all connections
        for (const conn of allConnections) {
          await conn.disconnect();
        }
        process.exit(0);
      });

      // Handle Ctrl+C gracefully
      process.on("SIGINT", async () => {
        console.log(chalk.yellow("\nExiting MCP terminal..."));
        // Disconnect from all connections
        for (const conn of allConnections) {
          await conn.disconnect();
        }
        process.exit(0);
      });
    });
}

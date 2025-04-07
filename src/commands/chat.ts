import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import os from "os";
import path from "path";
import { createInterface } from "readline";
import { callLLM } from "../utils/llmClient.js";
import { connectToAllServers } from "../utils/mcpConnection.js";

// Interface for conversation messages
interface ConversationMessage {
  role: string;
  content: string | any[]; // Allow both string and structured content
}

interface McpTool {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  serverName?: string; // Server this tool belongs to
}

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to handle chat session
async function startChatSession() {
  console.log(chalk.blue("Starting chat session with LLM..."));
  console.log(chalk.yellow("Type 'exit' or 'quit' to end the session.\n"));

  // Check OpenAI API key
  const hasApiKey = checkOpenAIKey();
  if (!hasApiKey) {
    console.log(
      chalk.red(
        "OpenAI API key not found. Please set the OPENAI_API_KEY environment variable."
      )
    );
    console.log(
      chalk.yellow(
        "You can create a .env file in the current directory or in your home directory with:\nOPENAI_API_KEY=your_api_key"
      )
    );
    rl.close();
    return;
  }

  // Track conversation history
  const history: ConversationMessage[] = [];

  // Initial system message
  history.push({
    role: "system",
    content:
      "You're an AI assistant powered by MCP. You can help with various tasks using MCP tools."
  });

  // Connect to all available MCP servers
  console.log(chalk.blue("Connecting to all available MCP servers..."));
  const connections = await connectToAllServers();

  if (connections.length === 0) {
    console.log(
      chalk.red(
        "No MCP servers could be connected. Please check your configuration."
      )
    );
    rl.close();
    return;
  }

  console.log(chalk.green(`Connected to ${connections.length} MCP servers`));

  // Fetch all available tools from all servers
  let allTools: McpTool[] = [];
  const toolToServerMap = new Map<string, string>();

  for (const connection of connections) {
    const serverName = connection.getServerName();
    console.log(
      chalk.blue(`Fetching tools from server: ${chalk.green(serverName)}`)
    );

    const serverTools = await connection.listTools();
    if (serverTools && serverTools.length > 0) {
      // Store original tool names but keep track of which server they belong to
      const mappedTools = serverTools.map((tool) => {
        // Store mapping of tool name to server name
        toolToServerMap.set(tool.name, serverName);

        return {
          ...tool,
          serverName // Add server metadata but keep original name
        };
      });

      // Add to the combined list
      allTools = [...allTools, ...mappedTools];

      console.log(
        chalk.green(`Found ${mappedTools.length} tools on server ${serverName}`)
      );
    } else {
      console.log(chalk.yellow(`No tools found on server ${serverName}`));
    }
  }

  if (allTools.length > 0) {
    console.log(
      chalk.blue(`Total tools available: ${chalk.green(allTools.length)}`)
    );
    // allTools.forEach((tool) => {
    //   console.log(
    //     chalk.green(
    //       `- ${tool.name} (from ${tool.serverName}): ${
    //         tool.description || "No description"
    //       }`
    //     )
    //   );
    // });
  } else {
    console.log(chalk.yellow("No tools found on any server"));
  }

  console.log(); // Empty line for better spacing

  // Start chat loop
  let chatActive = true;

  while (chatActive) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question(chalk.green("You: "), resolve);
    });

    // Check for exit command
    if (
      userInput.toLowerCase() === "exit" ||
      userInput.toLowerCase() === "quit"
    ) {
      chatActive = false;
      continue;
    }

    // Add user message to history
    history.push({ role: "user", content: userInput });

    try {
      // Call LLM with conversation history and all available tools
      console.log(chalk.yellow("AI is thinking..."));

      // Call LLM with all tools and all connections
      const response = await callLLM(history, allTools, connections);

      // Display response
      console.log(chalk.blue("AI: ") + response);

      // Add assistant response to history
      history.push({ role: "assistant", content: response });
    } catch (error) {
      console.error(chalk.red("Error calling LLM:"), error);

      // Add error message to keep conversation flowing
      const errorMessage =
        "I'm sorry, I encountered an error processing your request. Please try again.";
      console.log(chalk.blue("AI: ") + errorMessage);
      history.push({ role: "assistant", content: errorMessage });
    }
  }

  // Clean up all connections
  console.log(chalk.blue("Disconnecting from all MCP servers..."));
  for (const connection of connections) {
    await connection.disconnect();
  }
  rl.close();
}

// Function to check if OpenAI API key is set
function checkOpenAIKey(): boolean {
  // Check environment variable
  if (process.env.OPENAI_API_KEY) {
    return true;
  }

  // Check .env file in current directory
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      if (
        envContent.includes("OPENAI_API_KEY=") &&
        !envContent.includes("OPENAI_API_KEY=your_")
      ) {
        return true;
      }
    }
  } catch (e) {
    // Ignore file reading errors
  }

  // Check .env file in home directory
  try {
    const homeEnvPath = path.join(os.homedir(), ".env");
    if (fs.existsSync(homeEnvPath)) {
      const envContent = fs.readFileSync(homeEnvPath, "utf8");
      if (
        envContent.includes("OPENAI_API_KEY=") &&
        !envContent.includes("OPENAI_API_KEY=your_")
      ) {
        return true;
      }
    }
  } catch (e) {
    // Ignore file reading errors
  }

  return false;
}

export function chatCommand(program: Command): void {
  program
    .command("chat")
    .description(
      "Start an interactive chat session with LLM using all available MCP tools"
    )
    .action(async () => {
      try {
        await startChatSession();
      } catch (error) {
        console.error(chalk.red("Error starting chat session:"), error);
        process.exit(1);
      }
    });
}

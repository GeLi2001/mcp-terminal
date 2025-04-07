#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

// Path to the config file
const configPath = path.join(os.homedir(), ".mcp", "config.json");

console.log("MCP Terminal Configuration Test");
console.log("-------------------------------------");

// Check if config file exists
if (fs.existsSync(configPath)) {
  console.log("✓ Configuration file found:", configPath);

  try {
    // Read and parse the config file
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    console.log("✓ Configuration file is valid JSON");

    // Check if mcpServers is defined
    if (config.mcpServers && typeof config.mcpServers === "object") {
      console.log("✓ mcpServers section found");

      const serverCount = Object.keys(config.mcpServers).length;
      console.log(`  - ${serverCount} server(s) configured`);

      // List all configured servers
      Object.entries(config.mcpServers).forEach(([name, server]) => {
        console.log(`  - ${name}:`);

        if (server.command) {
          console.log(
            `    Command: ${server.command} ${(server.args || []).join(" ")}`
          );
        }

        if (server.url) {
          console.log(`    URL: ${server.url}`);
        }
      });

      // Try to start the first server as a test if user requests it
      const firstServerName = Object.keys(config.mcpServers)[0];

      if (firstServerName) {
        console.log("\nTo test connecting to the first server, run:");
        console.log(`npx @modelcontextprotocol/inspector ${firstServerName}`);
      }
    } else {
      console.log("✗ mcpServers section not found or invalid");
    }
  } catch (err) {
    console.error("✗ Error parsing config file:", err.message);
  }
} else {
  console.log("✗ Configuration file not found");
  console.log("Expected location:", configPath);

  // Create example config
  const exampleConfig = {
    defaultModel: "claude-3-opus-20240229",
    mcpServers: {
      filesystem: {
        command: "npx",
        args: [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          os.homedir() + "/Desktop",
          os.homedir() + "/Downloads"
        ]
      }
    }
  };

  console.log("\nWould you like to create an example config? (y/n)");
  process.stdin.once("data", (data) => {
    const answer = data.toString().trim().toLowerCase();

    if (answer === "y" || answer === "yes") {
      try {
        // Create directory if it doesn't exist
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        // Write config file
        fs.writeFileSync(
          configPath,
          JSON.stringify(exampleConfig, null, 2),
          "utf8"
        );
        console.log("✓ Example config created at", configPath);

        console.log("\nTo install a filesystem server, run:");
        console.log("npm install -g @modelcontextprotocol/server-filesystem");
      } catch (err) {
        console.error("✗ Error creating config:", err.message);
      }
    }

    process.exit(0);
  });
}

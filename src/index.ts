#!/usr/bin/env node

import chalk from "chalk";
import { program } from "commander";
import { chatCommand } from "./commands/chat.js";
import { configureCommand } from "./commands/configure.js";
import { startCommand } from "./commands/start.js";

// Use hardcoded version - can be updated during build process if needed
const VERSION = "0.1.0";

// Setup the CLI program
program
  .name("mcp-terminal")
  .description(
    "Terminal-based interactive client for Model Context Protocol (MCP) servers"
  )
  .version(VERSION);

// Register commands
startCommand(program);
configureCommand(program);
chatCommand(program);

// Default behavior - show help if no command specified
if (process.argv.length === 2) {
  console.log(chalk.bold.blue("Welcome to MCP CLI!"));
  console.log("Run with a command or use --help to see available options.\n");
  program.help();
}

// Parse command line arguments
program.parse(process.argv);

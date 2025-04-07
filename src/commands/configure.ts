import chalk from "chalk";
import { execSync } from "child_process";
import { Command } from "commander";
import * as fs from "fs";
import openEditor from "open-editor";
import * as path from "path";
import { configManager } from "../config/configManager.js";

// Function to detect available editors on the system
function detectAvailableEditor(): string | null {
  const commonEditors = [
    { cmd: "code", args: ["-g"] }, // VS Code
    { cmd: "subl", args: [] }, // Sublime Text
    { cmd: "atom", args: [] }, // Atom
    { cmd: "nano", args: [] }, // Nano
    { cmd: "vim", args: [] }, // Vim
    { cmd: "vi", args: [] } // Vi
  ];

  for (const editor of commonEditors) {
    try {
      execSync(`which ${editor.cmd}`, { stdio: "ignore" });
      return editor.cmd;
    } catch (e) {
      // Editor not found, try next one
    }
  }

  return null;
}

// Function to manually open config file with specified editor
function openWithEditor(filePath: string, editorCmd: string): boolean {
  try {
    console.log(chalk.blue(`Opening with ${editorCmd}...`));
    execSync(`${editorCmd} "${filePath}"`, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to open with ${editorCmd}:`), error);
    return false;
  }
}

// Function to open the directory containing a file
function openDirectory(filePath: string): boolean {
  try {
    const dirPath = path.dirname(filePath);
    console.log(chalk.blue(`Opening directory: ${dirPath}`));

    // Determine the correct command based on platform
    let command = "";
    if (process.platform === "darwin") {
      command = `open "${dirPath}"`;
    } else if (process.platform === "win32") {
      command = `explorer "${dirPath}"`;
    } else {
      command = `xdg-open "${dirPath}"`;
    }

    execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to open directory:`), error);
    return false;
  }
}

export function configureCommand(program: Command): void {
  program
    .command("configure")
    .description("Open the MCP configuration file in your default editor")
    .action(async () => {
      const configPath = configManager.getConfigFilePath();

      console.log(
        chalk.blue("Opening MCP configuration file:"),
        chalk.green(configPath)
      );

      try {
        // Ensure the config file exists
        configManager.getServers();

        // Check if EDITOR environment variable is set
        if (process.env.EDITOR) {
          try {
            // Try to open the config file in the default editor
            openEditor([configPath]);

            console.log(
              chalk.yellow(
                `\nAfter saving and closing the editor, your changes will be applied.`
              )
            );
            return;
          } catch (error) {
            console.log(
              chalk.yellow(
                "Error opening with default editor. Trying alternative methods..."
              )
            );
          }
        }

        // If EDITOR not set or opening failed, try to detect an available editor
        const availableEditor = detectAvailableEditor();

        if (availableEditor) {
          const success = openWithEditor(configPath, availableEditor);

          if (success) {
            console.log(
              chalk.yellow(
                `\nAfter saving and closing the editor, your changes will be applied.`
              )
            );
            console.log(
              chalk.blue(
                `\nTip: To avoid this warning in the future, set your EDITOR environment variable:\n` +
                  `   export EDITOR=${availableEditor}\n` +
                  `Add this line to your ~/.zshrc or ~/.bashrc file.`
              )
            );
            return;
          }
        }

        // Try opening the directory containing the config file
        const dirOpened = openDirectory(configPath);

        if (dirOpened) {
          console.log(
            chalk.yellow(
              `\nThe folder containing the configuration file has been opened.\n` +
                `Please edit the file named "${path.basename(
                  configPath
                )}" to make your changes.`
            )
          );
          return;
        }

        // If all else fails, print the contents and provide manual instructions
        printConfigInfo(configPath);
      } catch (error) {
        console.error(chalk.red("Error accessing configuration file:"), error);
        process.exit(1);
      }
    });
}

// Function to print config file contents and manual editing instructions
function printConfigInfo(configPath: string): void {
  console.log(
    chalk.yellow(
      "\nCould not open editor automatically. You can manually edit the file at:"
    )
  );
  console.log(chalk.green(configPath));

  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    console.log(chalk.blue("\nCurrent configuration:"));
    console.log(chalk.white(fileContent));

    console.log(
      chalk.yellow(
        "\nTo edit this file, open it in any text editor and save your changes."
      )
    );
    console.log(
      chalk.blue(
        `\nTo avoid this issue in the future, set your EDITOR environment variable:\n` +
          `   export EDITOR=nano\n` +
          `Add this line to your ~/.zshrc or ~/.bashrc file.`
      )
    );
  } catch (e) {
    console.error(chalk.red("Could not read configuration file."));
  }
}

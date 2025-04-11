import dotenv from "dotenv";
import { McpConnection } from "./mcpConnection.js";

// Load environment variables
dotenv.config();

// Supported LLM providers
type LLMProvider = 'openai' | 'deepseek';

// Define interfaces
interface ConversationMessage {
  role: string;
  content: string | any[]; // Allow both string and structured content
}

interface McpTool {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  serverName?: string; // The name of the server this tool belongs to
}

// TypeScript interfaces for OpenAI responses
interface OpenAIResponseChoice {
  message: {
    content: string | null;
    role: string;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  finish_reason: string;
  index: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIResponseChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Message types for OpenAI API
type OpenAIMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | null;
      tool_calls?: any[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

/**
 * Call the language model with conversation history
 * @param history The conversation history
 * @param mcpTools All available tools from all servers
 * @param mcpConnections All available MCP connections
 * @returns The response from the language model
 */
export async function callLLM(
  history: ConversationMessage[],
  mcpTools: McpTool[] = [],
  mcpConnections: McpConnection[] = []
): Promise<string> {
  // console.log("mcpTools", mcpTools);
  try {
    // Determine provider and get API key
    const provider: LLMProvider = process.env.LLM_PROVIDER as LLMProvider || 'openai';
    const apiKey = provider === 'deepseek'
      ? process.env.DEEPSEEK_API_KEY
      : process.env.OPENAI_API_KEY;
    const llmModel = provider === 'deepseek'
      ? 'deepseek-chat'
      : 'gpt-4o';

    //console.log(`Using ${provider.toUpperCase()} with model ${llmModel}`);

    if (!apiKey) {
      throw new Error(`${provider.toUpperCase()}_API_KEY environment variable is not set`);
    }

    // Format messages for API
    const formattedMessages: OpenAIMessage[] = history.map((msg) => ({
      role:
        msg.role === "system" || msg.role === "user" || msg.role === "assistant"
          ? (msg.role as "system" | "user" | "assistant")
          : "user",
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content)
    }));

    // console.log("Tools passed to callLLM:", JSON.stringify(mcpTools, null, 2));

    // Prepare request based on provider
    let apiUrl: string;
    let requestBody: any;

    if (provider === 'deepseek') {
      apiUrl = "https://api.deepseek.com/v1/chat/completions";
      requestBody = {
        model: llmModel,
        messages: formattedMessages,
        temperature: 0.7
      };
    } else {
      // OpenAI
      apiUrl = "https://api.openai.com/v1/chat/completions";
      requestBody = {
        model: llmModel,
        messages: formattedMessages,
        temperature: 0.7
      };
    }

    // Add tools if available (only for OpenAI)
    if (mcpTools.length > 0) {
      // Format tools to match OpenAI function calling format
      requestBody.tools = mcpTools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description || `Call the ${tool.name} tool`,
          parameters: tool.parameters || { type: "object", properties: {} }
        }
      }));

      // console.log(
      //   "Formatted tools for OpenAI API:",
      //   JSON.stringify(requestBody.tools, null, 2)
      // );
    }

    // Make the API call
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${provider.toUpperCase()} API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const jsonResponse = provider === 'deepseek'
      ? (await response.json()) as OpenAIResponse // DeepSeek response format is similar to OpenAI
      : (await response.json()) as OpenAIResponse;
    // console.log("OpenAI response:", JSON.stringify(jsonResponse, null, 2));

    // Check if the response includes a tool call
    const toolCalls = jsonResponse.choices?.[0]?.message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      let result = "I need to use some tools to help answer that:\n\n";

      // Create updated messages for the follow-up request
      const updatedMessages: OpenAIMessage[] = [
        ...formattedMessages,
        {
          role: "assistant",
          content: null,
          tool_calls: toolCalls
        }
      ];

      // Add tool response messages for each tool call
      for (const toolCall of toolCalls) {
        let toolResult;
        const toolName = toolCall.function.name;
        let toolArgs;

        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error("Error parsing tool arguments:", e);
          toolArgs = { _error: "Failed to parse arguments" };
        }

        try {
          // Find which tool was called
          const tool = mcpTools.find((t) => t.name === toolName);
          if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
          }

          // Find the server this tool belongs to
          const serverName = tool.serverName;
          if (!serverName) {
            throw new Error(`No server name found for tool ${toolName}`);
          }

          // Find the connection for this server
          const connection = mcpConnections.find(
            (c) => c.getServerName() === serverName
          );
          if (!connection) {
            throw new Error(`No connection found for server ${serverName}`);
          }

          console.log(`Calling tool ${toolName} on server ${serverName}`);

          // Call the tool with its original name (no need to strip prefix anymore)
          toolResult = await connection.callTool(toolName, toolArgs);

          // Add a proper tool message for this specific tool call
          updatedMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content:
              typeof toolResult === "object"
                ? JSON.stringify(toolResult)
                : String(toolResult)
          });

          // Also build the result text for user feedback
          result += `- Used ${toolName} on server ${serverName}\n`;
          result += `  Result: ${
            typeof toolResult === "object"
              ? JSON.stringify(toolResult)
              : toolResult
          }\n\n`;
        } catch (error: any) {
          console.error(`Error with MCP tool call:`, error);
          // Still need to add a tool response even on error
          updatedMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message })
          });

          result += `- Error using ${toolName}: ${error.message}\n`;
        }
      }

      // console.log(
      //   "Updated messages for final call:",
      //   JSON.stringify(updatedMessages, null, 2)
      // );

      // Get final response with tool results
      const finalResponse = await fetch(
        apiUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: llmModel,
            messages: updatedMessages,
            temperature: 0.7
          })
        }
      );

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        throw new Error(
          `${provider.toUpperCase()} API error: ${finalResponse.status} ${finalResponse.statusText} - ${errorText}`
        );
      }

      const finalJsonResponse = (await finalResponse.json()) as OpenAIResponse;
      // Return both the result information and the final AI response
      return `Tools used:\n${result}\n${
        finalJsonResponse.choices[0].message.content || ""
      }`;
    }

    // Return the content for a normal response without tool calls
    return jsonResponse.choices[0].message.content || "";
  } catch (error: any) {
    console.error("Error in callLLM:", error);
    throw error;
  }
}

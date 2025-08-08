import Anthropic from "@anthropic-ai/sdk";
import {
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIStreamChunk,
} from "./types.ts";

export class MessageTranslator {
  /**
   * Convert OpenAI request format to Claude API format
   */
  static openaiToClaudeRequest(openaiRequest: OpenAIChatRequest): Anthropic.MessageCreateParams {
    const { messages, model, max_tokens = 4096, temperature, top_p, stop, stream } = openaiRequest;

    // Separate system messages from user/assistant messages
    let systemMessage = "";
    const claudeMessages: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      if (message.role === "system") {
        systemMessage = message.content;
      } else if (message.role === "user" || message.role === "assistant") {
        claudeMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    // Map OpenAI model names to Claude model names
    const claudeModel = this.mapOpenAIModelToClaude(model);

    const claudeRequest: Anthropic.MessageCreateParams = {
      model: claudeModel,
      max_tokens,
      messages: claudeMessages,
      stream: stream || false,
    };

    if (systemMessage) {
      claudeRequest.system = systemMessage;
    }

    if (temperature !== undefined) {
      claudeRequest.temperature = Math.max(0, Math.min(1, temperature));
    }

    if (top_p !== undefined) {
      claudeRequest.top_p = Math.max(0, Math.min(1, top_p));
    }

    if (stop) {
      claudeRequest.stop_sequences = Array.isArray(stop) ? stop : [stop];
    }

    return claudeRequest;
  }

  /**
   * Convert Claude response to OpenAI response format
   */
  static claudeToOpenaiResponse(claudeResponse: Anthropic.Message, requestModel: string): OpenAIChatResponse {
    const content = claudeResponse.content
      .filter(block => block.type === "text")
      .map(block => (block as Anthropic.TextBlock).text)
      .join("");

    const finishReason = this.mapClaudeStopReason(claudeResponse.stop_reason);

    return {
      id: claudeResponse.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: requestModel,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
          },
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: claudeResponse.usage.input_tokens,
        completion_tokens: claudeResponse.usage.output_tokens,
        total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
      },
    };
  }

  /**
   * Convert Claude stream event to OpenAI stream chunk
   */
  static claudeStreamToOpenaiChunk(
    event: Anthropic.MessageStreamEvent,
    requestModel: string,
    messageId: string
  ): OpenAIStreamChunk | null {
    const created = Math.floor(Date.now() / 1000);

    switch (event.type) {
      case "message_start":
        return {
          id: messageId,
          object: "chat.completion.chunk",
          created,
          model: requestModel,
          choices: [
            {
              index: 0,
              delta: { role: "assistant" },
              finish_reason: null,
            },
          ],
        };

      case "content_block_delta":
        if (event.delta.type === "text_delta" && event.delta.text) {
          return {
            id: messageId,
            object: "chat.completion.chunk",
            created,
            model: requestModel,
            choices: [
              {
                index: 0,
                delta: { content: event.delta.text },
                finish_reason: null,
              },
            ],
          };
        }
        return null;

      case "message_stop":
        // For message_stop events, we don't have direct access to stop_reason
        // We'll default to "stop" and let the final chunk handle the actual reason
        return {
          id: messageId,
          object: "chat.completion.chunk",
          created,
          model: requestModel,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop",
            },
          ],
        };

      default:
        return null;
    }
  }

  /**
   * Map OpenAI model names to Claude model names
   */
  private static mapOpenAIModelToClaude(openaiModel: string): string {
    // Map common OpenAI model names to Claude equivalents
    const modelMap: Record<string, string> = {
      "gpt-4": "claude-3-5-sonnet-20241022",
      "gpt-4-turbo": "claude-3-5-sonnet-20241022",
      "gpt-4o": "claude-3-5-sonnet-20241022",
      "gpt-3.5-turbo": "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku": "claude-3-5-haiku-20241022",
      "claude-3-opus": "claude-3-opus-20240229",
      "claude-3-sonnet": "claude-3-sonnet-20240229",
      "claude-3-haiku": "claude-3-haiku-20240307",
      // Add the new Sonnet 4 model
      "claude-sonnet-4": "claude-sonnet-4-20250514",
      "claude-4": "claude-sonnet-4-20250514",
    };

    // If the model is already a Claude model, return as-is
    if (openaiModel.startsWith("claude-")) {
      return openaiModel;
    }

    // Otherwise, map or default to latest Sonnet
    return modelMap[openaiModel] || "claude-3-5-sonnet-20241022";
  }

  /**
   * Map Claude stop reasons to OpenAI finish reasons
   */
  private static mapClaudeStopReason(
    claudeStopReason: string | null
  ): "stop" | "length" | "content_filter" | null {
    switch (claudeStopReason) {
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "stop_sequence":
        return "stop";
      default:
        return "stop";
    }
  }
}
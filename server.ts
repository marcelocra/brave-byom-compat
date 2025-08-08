#!/usr/bin/env -S deno run --allow-net --allow-env

import Anthropic from "npm:@anthropic-ai/sdk";
import { ClaudeClient } from "./claude-client.ts";
import { MessageTranslator } from "./translator.ts";
import { OpenAIChatRequest } from "./types.ts";

// Configuration
const PORT = parseInt(Deno.env.get("PORT") || "8000");
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY") || "";
const DEBUG = Deno.env.get("DEBUG") === "true";

if (!CLAUDE_API_KEY) {
  console.error("Error: CLAUDE_API_KEY environment variable is required");
  Deno.exit(1);
}

const claudeClient = new ClaudeClient(CLAUDE_API_KEY);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle OPTIONS requests for CORS
 */
function handleOptions(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match?.[1] ?? null;
}

/**
 * Handle chat completions endpoint
 */
async function handleChatCompletions(request: Request): Promise<Response> {
  try {
    // Validate API key (optional - you can implement your own auth logic)
    const _providedKey = extractApiKey(request);

    // Parse request body
    const openaiRequest: OpenAIChatRequest = await request.json();

    // Validate required fields
    if (!openaiRequest.messages || !Array.isArray(openaiRequest.messages)) {
      return new Response(
        JSON.stringify({
          error: "messages field is required and must be an array",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate messages array is not empty
    if (openaiRequest.messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "messages array cannot be empty",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate model field
    if (!openaiRequest.model || typeof openaiRequest.model !== "string") {
      return new Response(
        JSON.stringify({
          error: "model field is required and must be a string",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (DEBUG) {
      console.log("=== INCOMING OPENAI REQUEST ===");
      console.log(JSON.stringify(openaiRequest, null, 2));
    }

    // Convert to Claude format
    const claudeRequest =
      MessageTranslator.openaiToClaudeRequest(openaiRequest);

    if (DEBUG) {
      console.log("=== CONVERTED CLAUDE REQUEST ===");
      console.log(JSON.stringify(claudeRequest, null, 2));
    }

    // Handle streaming vs non-streaming
    if (openaiRequest.stream) {
      return handleStreamingResponse(claudeRequest, openaiRequest.model);
    } else {
      return handleNonStreamingResponse(claudeRequest, openaiRequest.model);
    }
  } catch (error) {
    console.error("Error handling chat completion:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}

/**
 * Handle non-streaming response
 */
async function handleNonStreamingResponse(
  claudeRequest: Anthropic.MessageCreateParams,
  requestModel: string
): Promise<Response> {
  try {
    const claudeResponse = await claudeClient.createMessage(claudeRequest);

    if (DEBUG) {
      console.log("=== CLAUDE RESPONSE ===");
      console.log(JSON.stringify(claudeResponse, null, 2));
    }

    const openaiResponse = MessageTranslator.claudeToOpenaiResponse(
      claudeResponse,
      requestModel
    );

    if (DEBUG) {
      console.log("=== FINAL OPENAI RESPONSE ===");
      console.log(JSON.stringify(openaiResponse, null, 2));
    }

    return new Response(JSON.stringify(openaiResponse), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in non-streaming response:", error);

    // Handle Anthropic SDK errors gracefully
    if (error instanceof Error) {
      return new Response(
        JSON.stringify({
          error: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}

/**
 * Handle streaming response
 */
function handleStreamingResponse(
  claudeRequest: Anthropic.MessageCreateParams,
  requestModel: string
): Response {
  const messageId = `chatcmpl-${crypto.randomUUID()}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of claudeClient.createMessageStream(
          claudeRequest
        )) {
          const chunk = MessageTranslator.claudeStreamToOpenaiChunk(
            event,
            requestModel,
            messageId
          );

          if (chunk) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
        }

        // Send final chunk
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Error in streaming response:", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
}

/**
 * Main request handler
 */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return handleOptions();
  }

  // Health check endpoint
  if (url.pathname === "/health" && method === "GET") {
    return new Response(JSON.stringify({ status: "healthy" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Chat completions endpoint
  if (url.pathname === "/v1/chat/completions" && method === "POST") {
    return await handleChatCompletions(request);
  }

  // Models endpoint (optional)
  if (url.pathname === "/v1/models" && method === "GET") {
    const models = {
      object: "list",
      data: [
        {
          id: "claude-sonnet-4-20250514",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "anthropic",
        },
        {
          id: "claude-3-5-sonnet-20241022",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "anthropic",
        },
        {
          id: "claude-3-5-haiku-20241022",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "anthropic",
        },
      ],
    };

    return new Response(JSON.stringify(models), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Default 404 response
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Start server using Deno.serve (modern approach)
console.log(
  `🚀 Claude-to-OpenAI compatibility server starting on port ${PORT}`
);
console.log(`📡 Endpoint: http://localhost:${PORT}/v1/chat/completions`);
console.log(`🔑 Using Claude API key: ${CLAUDE_API_KEY.substring(0, 10)}...`);

Deno.serve({ port: PORT }, handler);

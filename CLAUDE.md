# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude API to OpenAI API compatibility layer designed for Brave Leo's Bring Your Own Model (BYOM) feature. It translates OpenAI chat completion requests to Claude's API format and returns OpenAI-compatible responses using the official Anthropic SDK.

## Architecture

The project consists of:
- `types.ts` - TypeScript interfaces for OpenAI API compatibility formats
- `translator.ts` - Core translation logic between OpenAI and Claude API formats  
- `claude-client.ts` - Wrapper around official Anthropic SDK client
- `server.ts` - Deno HTTP server implementing OpenAI-compatible endpoints
- `deno.json` - Deno configuration with official Anthropic SDK dependency

## Dependencies

- `@anthropic-ai/sdk` (v0.58.0) - Official Anthropic TypeScript SDK
- Deno built-in HTTP server (`Deno.serve`)

## Key Components

### MessageTranslator (`translator.ts`)
- `openaiToClaudeRequest()` - Converts OpenAI chat format to `Anthropic.MessageCreateParams`
- `claudeToOpenaiResponse()` - Converts `Anthropic.Message` to OpenAI format
- `claudeStreamToOpenaiChunk()` - Handles `Anthropic.MessageStreamEvent` to OpenAI chunks
- `mapOpenAIModelToClaude()` - Maps model names including Claude Sonnet 4 support

### ClaudeClient (`claude-client.ts`) 
- Wrapper around official `Anthropic` client
- `createMessage()` - Non-streaming requests using `client.messages.create()`
- `createMessageStream()` - Streaming requests with proper async generator handling

### Server (`server.ts`)
- `/v1/chat/completions` endpoint (POST) - Main chat completions endpoint
- `/v1/models` endpoint (GET) - Lists available Claude models
- `/health` endpoint (GET) - Health check
- CORS support for browser usage
- Both streaming and non-streaming response handling
- Uses `Deno.serve()` built-in HTTP server

## Development Commands

```bash
# Start development server with auto-reload
deno task dev

# Start production server  
deno task start

# Run with custom port
PORT=3000 deno task start

# Environment setup
cp .env.example .env
# Edit .env with your CLAUDE_API_KEY
```

## Configuration

Set environment variables:
- `CLAUDE_API_KEY` (required) - Your Anthropic Claude API key from console.anthropic.com
- `PORT` (optional) - Server port, defaults to 8000

## Brave Leo BYOM Setup

1. Run the server: `deno task start`
2. In Brave Settings > Leo > Bring your own model:
   - Label: "Claude"  
   - Model request name: "claude-sonnet-4-20250514" (recommended) or other Claude model
   - Server endpoint: "http://localhost:8000/v1/chat/completions"
   - API Key: Leave blank

## API Translation Details

### Request Translation
- OpenAI `messages` array → Claude `messages` + separate `system` field using `Anthropic.MessageParam[]`
- OpenAI model names mapped to official Claude model IDs
- Parameters like `temperature`, `top_p`, `max_tokens` passed through to `Anthropic.MessageCreateParams`
- `stop` sequences converted to Claude `stop_sequences`

### Response Translation  
- `Anthropic.Message.content` blocks flattened to single OpenAI message content
- `Anthropic.Message.usage` tokens mapped to OpenAI format
- Claude stop reasons mapped to OpenAI finish reasons
- `Anthropic.MessageStreamEvent` converted to OpenAI SSE chunk format

### Model Mapping
- `gpt-4*` models → `claude-3-5-sonnet-20241022`
- `gpt-3.5-turbo` → `claude-3-5-haiku-20241022`
- `claude-4` / `claude-sonnet-4` → `claude-sonnet-4-20250514`
- Claude model names passed through unchanged

### Available Models
- `claude-sonnet-4-20250514` (latest, most capable)
- `claude-3-5-sonnet-20241022` (balanced performance)
- `claude-3-5-haiku-20241022` (fast, cost-effective)

## Error Handling

- Official SDK provides robust error handling with proper HTTP status codes
- JSON parsing errors return 400 Bad Request
- Missing required fields validated and return 400
- SDK handles streaming errors gracefully
- All errors include CORS headers for browser compatibility
- SDK automatically retries transient failures

## Benefits of Official SDK Usage

- **Type Safety**: Full TypeScript support with official `Anthropic.*` types
- **Error Handling**: Robust error handling and automatic retries
- **Maintenance**: Automatic updates for new API features
- **Performance**: Optimized HTTP client with connection pooling
- **Streaming**: Proper async generator support for streaming responses
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude API to OpenAI API compatibility layer designed for Brave Leo's Bring Your Own Model (BYOM) feature. It translates OpenAI chat completion requests to Claude's API format and returns OpenAI-compatible responses.

## Architecture

The project consists of:
- `types.ts` - TypeScript interfaces for both OpenAI and Claude API formats
- `translator.ts` - Core translation logic between API formats  
- `claude-client.ts` - HTTP client for Claude API with streaming support
- `server.ts` - Deno HTTP server implementing OpenAI-compatible endpoints

## Key Components

### MessageTranslator (`translator.ts`)
- `openaiToClaudeRequest()` - Converts OpenAI chat format to Claude messages format
- `claudeToOpenaiResponse()` - Converts Claude responses to OpenAI format
- `claudeStreamToOpenaiChunk()` - Handles streaming response translation
- `mapOpenAIModelToClaude()` - Maps model names between APIs

### ClaudeClient (`claude-client.ts`) 
- `createMessage()` - Non-streaming Claude API requests
- `createMessageStream()` - Streaming Claude API requests with SSE parsing

### Server (`server.ts`)
- `/v1/chat/completions` endpoint (POST) - Main chat completions endpoint
- `/v1/models` endpoint (GET) - Lists available models
- `/health` endpoint (GET) - Health check
- CORS support for browser usage
- Both streaming and non-streaming response handling

## Development Commands

```bash
# Start development server with auto-reload
deno task dev

# Start production server  
deno task start

# Run with custom port
PORT=3000 deno task start
```

## Configuration

Set environment variables:
- `CLAUDE_API_KEY` (required) - Your Anthropic Claude API key
- `PORT` (optional) - Server port, defaults to 8000

## Brave Leo BYOM Setup

1. Run the server: `deno task start`
2. In Brave Settings > Leo > Bring your own model:
   - Label: "Claude via Compatibility Layer"  
   - Model request name: "claude-3-5-sonnet-20241022" (or desired Claude model)
   - Server endpoint: "http://localhost:8000/v1/chat/completions"
   - API Key: Leave blank or use for additional auth

## API Translation Details

### Request Translation
- OpenAI `messages` array → Claude `messages` + separate `system` field
- OpenAI model names mapped to Claude model IDs
- Parameters like `temperature`, `top_p`, `max_tokens` passed through
- `stop` sequences converted to Claude `stop_sequences`

### Response Translation  
- Claude content blocks flattened to single OpenAI message content
- Claude `usage` tokens mapped to OpenAI format
- Claude stop reasons mapped to OpenAI finish reasons
- Streaming events converted to OpenAI SSE chunk format

### Model Mapping
- `gpt-4*` models → `claude-3-5-sonnet-20241022`
- `gpt-3.5-turbo` → `claude-3-5-haiku-20241022`
- Claude model names passed through unchanged

## Error Handling

- HTTP errors from Claude API propagated with status codes
- JSON parsing errors return 400 Bad Request
- Missing required fields validated and return 400
- Streaming errors close connection gracefully
- All errors include CORS headers for browser compatibility
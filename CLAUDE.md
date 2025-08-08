# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready Claude API to OpenAI API compatibility layer designed for Brave Leo's Bring Your Own Model (BYOM) feature. It translates OpenAI chat completion requests to Claude's API format and returns OpenAI-compatible responses using the official Anthropic SDK.

## Architecture

The project consists of:

- `types.ts` - TypeScript interfaces for OpenAI API compatibility formats
- `translator.ts` - Core translation logic between OpenAI and Claude API formats
- `claude-client.ts` - Wrapper around official Anthropic SDK client
- `server.ts` - Deno HTTP server implementing OpenAI-compatible endpoints
- `deno.json` - Deno configuration with official Anthropic SDK dependency
- `.env.example` - Environment variable template

## Dependencies

- `@anthropic-ai/sdk` (v0.58.0) - Official Anthropic TypeScript SDK
- Deno built-in HTTP server (`Deno.serve`)

## Key Components

### MessageTranslator (`translator.ts`)

- `openaiToClaudeRequest()` - Converts OpenAI chat format to `Anthropic.MessageCreateParams`
  - Handles multiple system messages by concatenating them
  - Validates and clamps temperature/top_p parameters
  - Uses exact model names from Leo input (no mapping)
  - Validates messages are non-empty strings and trims whitespace
  - Does NOT include `stream` parameter (handled by SDK)
- `claudeToOpenaiResponse()` - Converts `Anthropic.Message` to OpenAI format with content trimming
- `claudeStreamToOpenaiChunk()` - Handles `Anthropic.MessageStreamEvent` to OpenAI chunks
- `mapClaudeStopReason()` - Maps Claude stop reasons to OpenAI finish reasons

### ClaudeClient (`claude-client.ts`)

- Clean wrapper around official `Anthropic` client
- `createMessage()` - Non-streaming requests using `client.messages.create()` with `stream: false`
- `createMessageStream()` - Streaming requests using `client.messages.stream()` with async generators

### Server (`server.ts`)

- **Endpoints**:
  - `/v1/chat/completions` (POST) - Main chat completions endpoint with full validation
  - `/v1/models` (GET) - Lists available Claude models
  - `/health` (GET) - Health check endpoint
- **Features**:
  - Comprehensive request validation (messages array, model field, etc.)
  - Enhanced error handling with proper HTTP status codes
  - CORS support for browser compatibility
  - Both streaming and non-streaming response handling
  - Uses modern `Deno.serve()` API

## Development Commands

```bash
# Check TypeScript types
deno check --all *.ts

# Start development server with auto-reload
deno task dev

# Start production server
deno task start

# Run with custom port
PORT=3000 deno task start

# Environment setup
cp .env.example .env
# Edit .env with your CLAUDE_API_KEY

# Enable debug logging
DEBUG=true deno task start

# Debug with development server
DEBUG=true deno task dev
```

## Configuration

Set environment variables:

- `CLAUDE_API_KEY` (required) - Your Anthropic Claude API key from console.anthropic.com
- `PORT` (optional) - Server port, defaults to 8000
- `DEBUG` (optional) - Set to "true" to enable detailed request/response logging for debugging

## Brave Leo BYOM Setup

1. Run the server: `deno task start`
2. In Brave Settings > Leo > Bring your own model:
   - **Label**: "Claude"
   - **Model request name**: "claude-sonnet-4-20250514" (recommended) or other Claude model
   - **Server endpoint**: "http://localhost:8000/v1/chat/completions"
   - **API Key**: Leave blank (authentication handled via environment variable)

## API Translation Details

### Request Translation

- OpenAI `messages` array → Claude `messages` + separate `system` field using `Anthropic.MessageParam[]`
- Multiple system messages automatically concatenated
- **No model mapping** - Uses exact model name from Leo input
- Empty messages filtered out for clean requests
- Parameters like `temperature`, `top_p`, `max_tokens` validated and passed through to `Anthropic.MessageCreateParams`
- `stop` sequences converted to Claude `stop_sequences`
- **Critical**: Does NOT include `stream` parameter (SDK handles streaming internally)

### Response Translation

- `Anthropic.Message.content` blocks filtered and flattened to single OpenAI message content
- `Anthropic.Message.usage` tokens mapped to OpenAI format (input/output → prompt/completion)
- Claude stop reasons mapped to OpenAI finish reasons
- `Anthropic.MessageStreamEvent` converted to OpenAI SSE chunk format with proper event handling

### Model Support

- **No Mapping**: Uses exact model name provided by Brave Leo BYOM
- **Direct Pass-through**: Any valid Claude model name works (claude-sonnet-4-20250514, claude-3-5-sonnet-20241022, etc.)
- **Flexibility**: Supports any current or future Claude models without code changes

### Common Claude Models

- `claude-sonnet-4-20250514` (latest, most capable model)
- `claude-3-5-sonnet-20241022` (balanced performance and speed)
- `claude-3-5-haiku-20241022` (fast, cost-effective)

## Request Validation

The server performs comprehensive validation:

- **Required fields**: `messages` (non-empty array), `model` (string)
- **Message format**: Proper role/content structure, filters empty messages
- **Parameter bounds**: Temperature and top_p clamped to [0,1]
- **Content validation**: Ensures message content is non-empty string with whitespace trimming
- **Error responses**: Proper HTTP status codes with JSON error messages

## Error Handling

- **Client Errors**: 400 Bad Request for invalid requests with descriptive error messages
- **Server Errors**: 500 Internal Server Error with Anthropic SDK error details
- **Streaming Errors**: Graceful stream closure with error events
- **CORS Headers**: Included in all responses for browser compatibility
- **SDK Benefits**: Automatic retries, connection pooling, and robust error handling

## Request Flow

```
1. Brave Leo → POST /v1/chat/completions (OpenAI format)
2. Server validates request (messages, model, parameters)
3. MessageTranslator converts OpenAI → Claude format
4. ClaudeClient calls official Anthropic SDK
5. Response translated Claude → OpenAI format
6. Returned to Brave Leo in expected format
```

## Code Quality

- **TypeScript**: Full type safety with official SDK types
- **No Errors**: Clean compilation with only intentional unused variable hints
- **Testing**: All files pass `deno check --all *.ts`
- **Production Ready**: Comprehensive error handling and validation

## Why Not OpenAI SDK?

The OpenAI SDK is not used because:

- **Purpose**: We translate FROM OpenAI format TO Claude API, not OpenAI → OpenAI
- **Direction**: OpenAI SDK calls OpenAI's API, but we need Claude's API
- **Efficiency**: We handle OpenAI request parsing directly - SDK would add unnecessary overhead
- **Architecture**: Clean separation of concerns with manual type handling

## Development History

### Initial Implementation

- Built with custom HTTP client for Claude API
- Implemented basic OpenAI-compatible endpoints
- Added model mapping between OpenAI and Claude models
- Basic request/response translation

### Major Refactor: Official SDK Integration

- **Replaced custom HTTP client** with official `@anthropic-ai/sdk` (v0.58.0)
- **Enhanced type safety** using official SDK types instead of custom interfaces
- **Improved error handling** with SDK's built-in retry logic and connection pooling
- **Maintained OpenAI compatibility** while leveraging SDK benefits

### Critical Bug Fixes

User reported streaming errors after initial 2 messages worked:

**Root Cause**: Including `stream: stream || false` parameter in Claude API requests when using the official SDK

- The SDK's `.stream()` method handles streaming internally
- Manual stream parameter caused API conflicts

**Fixes Applied**:

1. **Removed stream parameter** from `translator.ts:openaiToClaudeRequest()`
2. **Removed model mapping** per user preference for direct pass-through
3. **Added content validation** to filter empty messages and trailing whitespace
4. **Enhanced error handling** throughout the request pipeline

**Result**: Full streaming and non-streaming functionality working with production-ready error handling

### Current State

- ✅ Production-ready with comprehensive validation
- ✅ Direct model pass-through (no mapping)
- ✅ Official Anthropic SDK integration
- ✅ Streaming and non-streaming support
- ✅ CORS and browser compatibility
- ✅ Robust error handling and TypeScript safety

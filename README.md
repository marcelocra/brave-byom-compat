# Brave Leo BYOM - Claude Compatibility Layer

A TypeScript/Deno compatibility layer that allows you to use Claude API with Brave Leo's Bring Your Own Model (BYOM) feature by providing an OpenAI-compatible API endpoint.

## Quick Start

1. **Copy the environment file and add your Claude API key:**

   ```bash
   cp .env.example .env
   # Edit .env and add your actual Claude API key
   ```

2. **Get a Claude API key from Anthropic:**

   - Visit [console.anthropic.com](https://console.anthropic.com)
   - Create an account and generate an API key
   - Copy the key (starts with `sk-ant-...`)

3. **Start the server:**

   ```bash
   deno task start
   ```

4. **Configure in Brave Leo:**
   - Open Brave Settings > Leo > Bring your own model
   - Click "Add new model"
   - Fill in:
     - **Label**: "Claude"
     - **Model request name**: "claude-sonnet-4-20250514"
     - **Server endpoint**: "http://localhost:8000/v1/chat/completions"
     - **API Key**: Leave blank (optional)

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `CLAUDE_API_KEY` - Your Anthropic Claude API key (required)
- `PORT` - Server port (optional, defaults to 8000)

## Available Models

The compatibility layer supports all Claude models:

- `claude-3-5-sonnet-20241022` (recommended)
- `claude-3-5-haiku-20241022` (faster, cheaper)
- `claude-3-opus-20240229`
- And others

## Development

```bash
# Development with auto-reload
deno task dev

# Production
deno task start

# Custom port
PORT=3000 deno task start
```

## How It Works

This server translates between OpenAI's chat completion API format (which Brave Leo expects) and Claude's message API format:

1. Receives OpenAI-format requests from Brave Leo
2. Translates to Claude API format
3. Calls Claude API
4. Translates response back to OpenAI format
5. Returns to Brave Leo

Both streaming and non-streaming responses are supported.

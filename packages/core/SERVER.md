# OpenCode Server

The OpenCode server is a Hono-based backend that handles all core functionality including chat, system prompts, sessions, and tool execution.

## Starting the Server

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Start the server (default port 3000)
bun run packages/core/src/index.ts server

# Or specify custom port and database
bun run packages/core/src/index.ts server --port 8080 --database custom.db
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### System Prompts

**Get all prompts:**
```bash
curl http://localhost:3000/api/prompts
```

**Get prompt by ID:**
```bash
curl http://localhost:3000/api/prompts/focused-debugging
```

**Get prompts by category:**
```bash
curl http://localhost:3000/api/prompts/category/coding
```

**Create custom prompt:**
```bash
curl -X POST http://localhost:3000/api/prompts/custom \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Prompt",
    "description": "A custom prompt for specific tasks",
    "content": "You are a specialized assistant for...",
    "category": "coding"
  }'
```

### Sessions

**Create new session:**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Chat Session",
    "systemPromptId": "focused-debugging",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022"
  }'
```

**List sessions:**
```bash
curl http://localhost:3000/api/sessions
```

**Get specific session:**
```bash
curl http://localhost:3000/api/sessions/session_123
```

### Chat

**Send message:**
```bash
curl -X POST http://localhost:3000/api/chat/sessions/session_123/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Help me debug this error: TypeError: Cannot read property...",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022"
  }'
```

**Get session messages:**
```bash
curl http://localhost:3000/api/chat/sessions/session_123/messages
```

**Update session system prompt:**
```bash
curl -X PUT http://localhost:3000/api/chat/sessions/session_123/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "systemPromptId": "code-reviewer"
  }'
```

### Tools

**List available tools:**
```bash
curl http://localhost:3000/api/tools
```

**Execute tool (mock for now):**
```bash
curl -X POST http://localhost:3000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "read",
    "parameters": { "path": "src/index.ts" },
    "sessionId": "session_123"
  }'
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for Anthropic provider
- `ANTHROPIC_DEFAULT_MODEL` - Optional default model (defaults to claude-3-5-sonnet-20241022)
- `ANTHROPIC_DISABLE_CACHE` - Set to 'true' to disable prompt caching (default: false)
- `ANTHROPIC_CACHE_SYSTEM_PROMPTS` - Set to 'false' to disable system prompt caching (default: true)
- `ANTHROPIC_CACHE_TOOLS` - Set to 'false' to disable tool definition caching (default: true)

## Response Format

All API responses follow this format:

**Success:**
```json
{
  "prompt": { "id": "...", "name": "...", ... },
  "session": { "id": "...", "title": "...", ... },
  "message": { "role": "assistant", "content": "...", ... }
}
```

**Error:**
```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

## Database

The server uses SQLite with WAL mode for concurrent access. Database file is stored in the app data directory by default, or can be specified with `--database` flag.

Database includes:
- Sessions with system prompt tracking
- Messages with provider/model metadata
- Tool execution history (when implemented)
- Authentication credentials (encrypted) 
import type { CommandModule } from "yargs"
import { createServer, getDefaultServerConfig } from "../server/index.js"
import { createAppInfo, ensureDirectories } from "../utils/app-context.js"
import { createAnthropicProvider } from "../providers/anthropic.js"
import { Log } from "../utils/log.js"
import { join } from "path"
import { isOk } from "@opencode/types"

interface ServerArgs {
  port?: number
  database?: string
  host?: string
}

export const ServerCommand: CommandModule<{}, ServerArgs> = {
  command: "server",
  describe: "Start the OpenCode backend server",
  builder: (yargs) =>
    yargs
      .option("port", {
        type: "number",
        describe: "Port to run the server on",
        default: parseInt(process.env.OPENCODE_PORT || '3000'),
      })
      .option("database", {
        type: "string",
        describe: "Database file path (relative to data directory)",
        default: process.env.OPENCODE_DATABASE_PATH || "opencode.db",
      })
      .option("host", {
        type: "string",
        describe: "Host to bind the server to",
        default: process.env.OPENCODE_HOST || "localhost",
      }),
  handler: async (args) => {
    try {
      // Initialize app context
      const appInfo = createAppInfo({ 
        cwd: process.cwd(), 
        version: "2.0.0" // TODO: Import from VERSION
      })
      await ensureDirectories(appInfo)

      // Setup database path
      const databasePath = args.database?.startsWith('/') 
        ? args.database 
        : join(appInfo.paths.data, args.database!)

      // Create server configuration
      const config = getDefaultServerConfig(databasePath)

      Log.Default.info("Starting OpenCode server", {
        port: config.port,
        database: databasePath,
        host: args.host,
      })

      // Create and start server
      const server = createServer(config)
      
      // Register LLM providers
      const anthropicResult = createAnthropicProvider()
      if (isOk(anthropicResult)) {
        server.registerProvider(anthropicResult.data)
        Log.Default.info("Registered Anthropic provider")
      } else {
        Log.Default.warn("Failed to register Anthropic provider", { 
          error: anthropicResult.error.message 
        })
      }
      
      // Graceful shutdown
      process.on('SIGINT', async () => {
        Log.Default.info("Shutting down server...")
        await server.stop()
        process.exit(0)
      })

      process.on('SIGTERM', async () => {
        Log.Default.info("Shutting down server...")
        await server.stop()
        process.exit(0)
      })

      // Start the server
      await server.start()

    } catch (error) {
      Log.Default.error("Failed to start server", { error })
      process.exit(1)
    }
  },
} 
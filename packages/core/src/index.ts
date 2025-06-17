import "zod-openapi/extend"
import { createAppInfo, ensureDirectories } from "./utils/app-context.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cmd/run.js"
import { ServerCommand } from "./cmd/server.js"
import { VERSION } from "./cmd/version.js"
import { Log } from "./utils/log.js"
import { AuthCommand, AuthLoginCommand } from "./cmd/auth.js"
import { UI } from "./cmd/ui.js"
import { createDatabase, type DatabaseConfig } from "./database/client.js"
import { join } from "path"
import { isOk } from "@opencode/types"

// Export system prompt functionality
export * from "./prompts/index.js"

// Export chat service
export * from "./chat/service.js"

// Export server functionality
export * from "./server/index.js"

// Export database functionality  
export * from "./database/client.js"
export * from "./database/migrations.js"
export * from "./database/schema.js"

const cli = yargs(hideBin(process.argv))
  .scriptName("opencode")
  .version(VERSION)
  .option("print-logs", {
    describe: "Print logs to stderr",
    type: "boolean",
  })
  .middleware(async () => {
    await Log.init({ print: process.argv.includes("--print-logs") })
    Log.Default.info("opencode", {
      version: VERSION,
      args: process.argv.slice(2),
    })
  })
  .usage("\n" + UI.logo())
  .command({
    command: "$0 [project]",
    describe: "Start opencode TUI",
    builder: (yargs) =>
      yargs.positional("project", {
        type: "string",
        describe: "path to start opencode in",
      }),
    handler: async (args) => {
      const cwd = args.project ? require('path').resolve(args.project) : process.cwd()
      process.chdir(cwd)
      
      // Initialize app context
      const appInfo = createAppInfo({ cwd, version: VERSION })
      await ensureDirectories(appInfo)
      
      // Initialize database
      const dbConfig: DatabaseConfig = {
        path: join(appInfo.paths.data, 'opencode.db')
      }
      
      const dbResult = createDatabase(dbConfig)
      if (isOk(dbResult)) {
        const db = dbResult.data
        const initResult = await db.initialize()
        if (isOk(initResult)) {
          // Database initialized successfully
        } else {
          console.error("Failed to initialize database schema:", initResult.error.message)
          process.exit(1)
        }
      } else {
        console.error("Failed to create database:", dbResult.error.message)
        process.exit(1)
      }
      
      UI.empty()
      UI.println(UI.logo("   "))
      UI.empty()
      UI.println(UI.Style.TEXT_WARNING_BOLD + "⚠  TUI not yet implemented in v2")
      UI.println("OpenCode v2 is being rebuilt. Use 'opencode run \"your message\"' for now.")
      UI.empty()
    },
  })
  .command(RunCommand)
  .command(ServerCommand)
  .command(AuthCommand)
  .fail((msg, err) => {
    if (
      msg.startsWith("Unknown argument") ||
      msg.startsWith("Not enough non-option arguments")
    ) {
      cli.showHelp("log")
    }
    Log.Default.error(msg, {
      err: err instanceof Error ? err : new Error(String(err)),
    })
  })
  .strict()

try {
  await cli.parse()
} catch (e) {
  Log.Default.error(e instanceof Error ? e : new Error(String(e)))
}

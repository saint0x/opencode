import { AuthAnthropic } from "../auth/anthropic.js"
import { Auth } from "../auth/index.js"
import { cmd } from "./cmd.js"
import * as prompts from "@clack/prompts"
import open from "open"
import { UI } from "./ui.js"

export const AuthCommand = cmd({
  command: "auth",
  describe: "manage credentials",
  builder: (yargs) =>
    yargs
      .command(AuthLoginCommand)
      .command(AuthLogoutCommand)
      .command(AuthListCommand)
      .demandCommand(),
  async handler() {},
})

export const AuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list providers",
  async handler() {
    UI.empty()
    prompts.intro("Credentials")
    const results = await Auth.all().then((x: Record<string, Auth.Info>) => Object.entries(x))
    for (const [providerID, result] of results) {
      const name = providerID // Simple fallback without models.dev
      prompts.log.info(`${name} ${UI.Style.TEXT_DIM}(${result.type})`)
    }

    prompts.outro(`${results.length} credentials`)
  },
})

export const AuthLoginCommand = cmd({
  command: "login",
  describe: "login to a provider",
  async handler() {
    UI.empty()
    prompts.intro("Add credential")
    // Simple provider list without models.dev complexity
    const providerOptions = [
      { label: "Anthropic", value: "anthropic", hint: "recommended" },
      { label: "OpenAI", value: "openai" },
      { label: "Google", value: "google" },
      { label: "Local (Ollama)", value: "ollama" },
      { label: "Other", value: "other" },
    ]
    
    let provider = await prompts.select({
      message: "Select provider",
      maxItems: 8,
      options: providerOptions,
    })

    if (prompts.isCancel(provider)) throw new UI.CancelledError()

    if (provider === "other") {
      provider = await prompts.text({
        message: "Enter provider id",
        validate: (x: string) =>
          x.match(/^[a-z-]+$/) ? undefined : "a-z and hyphens only",
      })
      if (prompts.isCancel(provider)) throw new UI.CancelledError()
      provider = provider.replace(/^@ai-sdk\//, "")
      if (prompts.isCancel(provider)) throw new UI.CancelledError()
      prompts.log.warn(
        `This only stores a credential for ${provider} - you will need configure it in opencode.json, check the docs for examples.`,
      )
    }

    if (provider === "amazon-bedrock") {
      prompts.log.info(
        "Amazon bedrock can be configured with standard AWS environment variables like AWS_PROFILE or AWS_ACCESS_KEY_ID",
      )
      prompts.outro("Done")
      return
    }

    if (provider === "anthropic") {
      const method = await prompts.select({
        message: "Login method",
        options: [
          {
            label: "Claude Pro/Max",
            value: "oauth",
          },
          {
            label: "API Key",
            value: "api",
          },
        ],
      })
      if (prompts.isCancel(method)) throw new UI.CancelledError()

      if (method === "oauth") {
        // some weird bug where program exits without this
        await new Promise((resolve) => setTimeout(resolve, 10))
        const { url, verifier } = await AuthAnthropic.authorize()
        prompts.note("Trying to open browser...")
        try {
          await open(url)
        } catch (e) {
          prompts.log.error(
            "Failed to open browser perhaps you are running without a display or X server, please open the following URL in your browser:",
          )
        }
        prompts.log.info(url)

        const code = await prompts.text({
          message: "Paste the authorization code here: ",
          validate: (x: string) => (x.length > 0 ? undefined : "Required"),
        })
        if (prompts.isCancel(code)) throw new UI.CancelledError()

        await AuthAnthropic.exchange(code, verifier)
          .then(() => {
            prompts.log.success("Login successful")
          })
          .catch(() => {
            prompts.log.error("Invalid code")
          })
        prompts.outro("Done")
        return
      }
    }

    const key = await prompts.password({
      message: "Enter your API key",
      validate: (x: string) => (x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(key)) throw new UI.CancelledError()
    await Auth.set(provider, {
      type: "api",
      key,
    })

    prompts.outro("Done")
  },
})

export const AuthLogoutCommand = cmd({
  command: "logout",
  describe: "logout from a configured provider",
  async handler() {
    UI.empty()
    const credentials = await Auth.all().then((x: Record<string, Auth.Info>) => Object.entries(x))
    prompts.intro("Remove credential")
    if (credentials.length === 0) {
      prompts.log.error("No credentials found")
      return
    }
    const providerID = await prompts.select({
      message: "Select provider",
      options: credentials.map(([key, value]: [string, Auth.Info]) => ({
        label: `${key} ${UI.Style.TEXT_DIM}(${value.type})`,
        value: key,
      })),
    })
    if (prompts.isCancel(providerID)) throw new UI.CancelledError()
    await Auth.remove(providerID)
    prompts.outro("Logout successful")
  },
})

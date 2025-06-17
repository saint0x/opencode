import { App } from "../app/app"
import { Bus } from "../bus"
import { Session } from "../session"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"

export namespace Share {
  const log = Log.create({ service: "share" })

  let queue: Promise<void> = Promise.resolve()
  const pending = new Map<string, any>()

  const state = App.state("share", async () => {
    Bus.subscribe(Storage.Event.Write, async (payload) => {
      await sync(payload.properties.key, payload.properties.content)
    })
  })

  export async function sync(key: string, content: any) {
    const [root, ...splits] = key.split("/")
    if (root !== "session") return
    const [, sessionID] = splits
    const session = await Session.get(sessionID)
    if (!session.share) return
    const { secret } = session.share
    pending.set(key, content)
    queue = queue
      .then(async () => {
        const content = pending.get(key)
        if (content === undefined) return
        pending.delete(key)

        return fetch(`${URL}/share_sync`, {
          method: "POST",
          body: JSON.stringify({
            sessionID: sessionID,
            secret,
            key: key,
            content,
          }),
        })
      })
      .then((x) => {
        if (x) {
          log.info("synced", {
            key: key,
            status: x.status,
          })
        }
      })
  }

  export async function init() {
    await state()
  }

  export const URL =
    process.env["OPENCODE_API"] ?? "https://api.dev.opencode.ai"

  export async function create(sessionID: string) {
    return fetch(`${URL}/share_create`, {
      method: "POST",
      body: JSON.stringify({ sessionID: sessionID }),
    })
      .then((x) => x.json())
      .then((x) => x as { url: string; secret: string })
  }
}

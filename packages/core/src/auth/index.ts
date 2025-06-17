import path from "path"
import { getAppInfo } from "../utils/app-context.js"
import fs from "fs/promises"
import { z } from "zod"

export namespace Auth {
  export const Oauth = z.object({
    type: z.literal("oauth"),
    refresh: z.string(),
    expires: z.number(),
  })

  export const Api = z.object({
    type: z.literal("api"),
    key: z.string(),
  })

  export const Info = z.discriminatedUnion("type", [Oauth, Api])
  export type Info = z.infer<typeof Info>

  function getFilepath() {
    return path.join(getAppInfo().paths.data, "auth.json")
  }

  export async function get(providerID: string) {
    const file = Bun.file(getFilepath())
    return file
      .json()
      .catch(() => ({}))
      .then((x) => x[providerID] as Info | undefined)
  }

  export async function all(): Promise<Record<string, Info>> {
    const file = Bun.file(getFilepath())
    return file.json().catch(() => ({}))
  }

  export async function set(key: string, info: Info) {
    const file = Bun.file(getFilepath())
    const data = await all()
    await Bun.write(file, JSON.stringify({ ...data, [key]: info }, null, 2))
    await fs.chmod(file.name!, 0o600)
  }

  export async function remove(key: string) {
    const file = Bun.file(getFilepath())
    const data = await all()
    delete data[key]
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(file.name!, 0o600)
  }
}

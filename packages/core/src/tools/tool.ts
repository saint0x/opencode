import type { ZodSchema } from "zod"

export namespace Tool {
  interface Metadata {
    title: string
    [key: string]: any
  }
  export type Context = {
    sessionID: string
    messageID: string
    abort: AbortSignal
  }
  export interface Info<
    Parameters extends ZodSchema = ZodSchema,
    M extends Metadata = Metadata,
  > {
    id: string
    description: string
    parameters: Parameters
    execute(
      args: Parameters extends ZodSchema ? Parameters["_output"] : any,
      ctx: Context,
    ): Promise<{
      metadata: M
      output: string
    }>
  }

  export function define<
    Parameters extends ZodSchema,
    Result extends Metadata,
  >(input: Info<Parameters, Result>): Info<Parameters, Result> {
    return input
  }
}

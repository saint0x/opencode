import { z, type ZodSchema } from "zod"
import { Log } from "./log"

const log = Log.create()

export abstract class NamedError extends Error {
  abstract schema(): ZodSchema
  abstract toObject(): { name: string; data: any }

  static create<Name extends string, Data extends ZodSchema>(
    name: Name,
    data: Data,
  ) {
    const schema = z
      .object({
        name: z.literal(name),
        data,
      })
      .openapi({
        ref: name,
      })
    const result = class extends NamedError {
      public static readonly Schema = schema

      public readonly name = name as Name

      constructor(
        public readonly data: z.input<Data>,
        options?: ErrorOptions,
      ) {
        super(name, options)
        this.name = name
        log.error(name, {
          ...this.data,
          cause: options?.cause?.toString(),
        })
      }

      static isInstance(input: any): input is InstanceType<typeof result> {
        return "name" in input && input.name === name
      }

      schema() {
        return schema
      }

      toObject() {
        return {
          name: name,
          data: this.data,
        }
      }
    }
    Object.defineProperty(result, "name", { value: name })
    return result
  }

  public static readonly Unknown = NamedError.create(
    "UnknownError",
    z.object({
      message: z.string(),
    }),
  )
}

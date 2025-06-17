import { z, type ZodSchema } from "zod"
import { Log } from "./log"
import { Result, ok, err, isOk } from "@opencode/types"

const log = Log.create()

export abstract class NamedError extends Error {
  abstract schema(): ZodSchema
  abstract toObject(): { name: string; data: any }

  static create<Name extends string, Data extends ZodSchema>(
    name: Name,
    data: Data,
  ) {
    const result: any = class extends NamedError {
      public static readonly Schema = z
        .object({
          name: z.literal(name),
          data: data,
        })
        .openapi({
          ref: name,
        })

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
        return result.Schema
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

export function safe<T>(fn: () => T): Result<T>
export function safe<T>(fn: () => Promise<T>): Promise<Result<T>>
export function safe<T>(fn: () => T | Promise<T>): Result<T> | Promise<Result<T>> {
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.then(ok).catch(err)
    }
    return ok(result)
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(String(value))
}

export function formatError(error: Error): string {
  return `${error.name}: ${error.message}`
}

export class OpenCodeError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = "OpenCodeError"
  }
}

// Schema validation helper
export function schema<T>(validator: (value: unknown) => T): {
  parse: (value: unknown) => Result<T>
  parseOrThrow: (value: unknown) => T
} {
  return {
    parse: (value: unknown): Result<T> => safe(() => validator(value)),
    parseOrThrow: (value: unknown): T => {
      const result = safe(() => validator(value))
      if (isOk(result)) {
        return result.data
      } else {
        throw result.error
      }
    }
  }
}

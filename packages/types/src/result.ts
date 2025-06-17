/**
 * Result<T, E> - A type that represents either a success (Ok) or failure (Err)
 * Based on Rust's Result type for comprehensive error handling
 */

export type Result<T, E = Error> = Ok<T> | Err<E>

export interface Ok<T> {
  readonly success: true
  readonly data: T
  readonly error?: never
}

export interface Err<E> {
  readonly success: false
  readonly data?: never
  readonly error: E
}

// Result constructors
export function ok<T>(data: T): Ok<T> {
  return { success: true, data }
}

export function err<E>(error: E): Err<E> {
  return { success: false, error }
}

// Result utilities
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success === true
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.success === false
}

// Result transformations
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  return isOk(result) ? ok(fn(result.data)) : result
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return isErr(result) ? err(fn(result.error)) : result
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  return isOk(result) ? fn(result.data) : result
}

// Safe async operations
export async function asyncResult<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> {
  try {
    const data = await promise
    return ok(data)
  } catch (error) {
    return err(error as E)
  }
}

// Extract data with fallback
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return isOk(result) ? result.data : fallback
}

export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  return isOk(result) ? result.data : fn(result.error)
}

// Throw on error (use sparingly)
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data
  }
  throw result.error
} 
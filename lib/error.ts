import { ZodError } from "zod"
import { Prisma } from "@prisma/client"
import { err } from "./response"

export class AuthError extends Error {}
export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export function mapErrorToResponse(e: unknown) {
  if (e instanceof ZodError) {
    return err("Validation error", e.flatten(), 422)
  }
  if (e instanceof AuthError) {
    return err("Authentication required", e.message, 401)
  }
  if (e instanceof ForbiddenError) {
    return err("Forbidden", e.message, 403)
  }
  if (e instanceof NotFoundError) {
    return err("Not Found", e.message, 404)
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return err("Conflict", e.meta, 409)
    }
  }
  // do not leak internal messages
  return err("Internal Server Error", undefined, 500)
}

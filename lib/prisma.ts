import "server-only"
import { PrismaClient } from "@prisma/client"

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined
}

// Use a singleton to avoid exhausting database connections in dev/hot reloads.
export const prisma =
  global.prismaGlobal ??
  new PrismaClient({
    log: ["warn", "error"],
  })

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma
}

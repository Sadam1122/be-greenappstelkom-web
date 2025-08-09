import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { withCors, handleCorsPreflight } from "@/lib/cors"

export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    await prisma.$queryRaw`SELECT 1`
    const resp = ok({ status: "ok" }, "Health OK")
    return withCors(resp, request)
  } catch {
    const resp = ok({ status: "degraded" }, "Health Degraded")
    return withCors(resp, request)
  }
}

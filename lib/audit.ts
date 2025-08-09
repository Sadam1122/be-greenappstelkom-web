import { prisma } from "./prisma"
import type { AuthClaims } from "./auth"

export async function writeAudit(params: {
  action: string
  user?: AuthClaims
  // Store arbitrary details; we will always enrich with locationId when provided
  details?: Record<string, unknown>
  locationId?: string | null
}) {
  try {
    const details = {
      ...(params.details ?? {}),
      // embed locationId to support scoped queries
      ...(params.locationId ? { locationId: params.locationId } : {}),
    }
    await prisma.auditLog.create({
      data: {
        action: params.action,
        details,
        userId: params.user?.sub,
      },
    })
  } catch (e) {
    console.error("audit_log_error", e)
  }
}

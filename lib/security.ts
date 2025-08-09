import type { AuthClaims } from "./auth"
import { ForbiddenError } from "./error"

// Validate role/location combination on user creation/update
export function assertRoleLocationCombination(role: AuthClaims["role"], locationId: string | null | undefined) {
  if (role === "SUPERADMIN") {
    if (locationId) throw new ForbiddenError("SUPERADMIN must not be assigned to a location")
  } else {
    if (!locationId) throw new ForbiddenError(`${role} must be assigned to a location`)
  }
}

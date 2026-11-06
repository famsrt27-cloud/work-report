import type { AppRole } from "@/types";

export const INDIVIDUAL_DASHBOARD_ROLES = ["supervisor", "manager", "admin"] satisfies AppRole[];

export function canAccessIndividualDashboard(roles: readonly AppRole[]) {
  return INDIVIDUAL_DASHBOARD_ROLES.some((role) => roles.includes(role));
}

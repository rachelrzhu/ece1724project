import type { DisplayUnitSystem } from "./scaling";

export const displayUnitCookie = "kitchen-display-units";

export function parseDisplayUnitSystem(value: string | undefined): DisplayUnitSystem {
  return value === "metric" || value === "imperial" ? value : "original";
}

export function saveDisplayUnitSystem(system: DisplayUnitSystem) {
  document.cookie = `${displayUnitCookie}=${system}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

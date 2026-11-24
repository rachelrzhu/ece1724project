export const usernamePattern = "[\\p{Alphabetic}0-9_]{1,32}";
export const usernameHint = "Use 1–32 letters, digits (0–9), or underscores. Letters are saved in lowercase.";

export function activeUsernameCooldown(availableAt: Date | null | undefined) {
  return availableAt && availableAt.getTime() > Date.now() ? availableAt : null;
}

export const usernamePattern = "[A-Za-z0-9_]{3,32}";
export const usernameHint = "Use 3–32 letters, numbers, or underscores. Letters are saved in lowercase.";

export function activeUsernameCooldown(availableAt: Date | null | undefined) {
  return availableAt && availableAt.getTime() > Date.now() ? availableAt : null;
}

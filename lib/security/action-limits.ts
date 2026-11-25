import "server-only";
import { takeLimit } from "./rate-limit";

export const activityLimitMessage = "Too many changes in a short time. Please try again later.";
export const uploadLimitMessage = "The photo upload limit has been reached. Please try again later.";

export async function takeUploadLimit(userId: string) {
  return await takeLimit("upload", userId) && await takeLimit("uploadGlobal", "global");
}

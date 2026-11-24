import "server-only";
export function isLocalPoc() {
  if (process.env.POC_LOCAL_ONLY !== "1" || process.env.VERCEL) return false;
  const url = new URL(process.env.DATABASE_URL || "http://invalid");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("Local POC requires a loopback database.");
  return true;
}

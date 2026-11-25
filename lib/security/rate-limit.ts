import "server-only";
import { createHmac } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/lib/db/client";

const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;
const policies = {
  signup: { max: 5, seconds: 15 * minute, global: false },
  signin: { max: 10, seconds: minute, global: false },
  authWrite: { max: 60, seconds: minute, global: false },
  recipe: { max: 20, seconds: hour, global: false },
  recipeContent: { max: 150, seconds: day, global: true },
  upload: { max: 8, seconds: hour, global: false },
  uploadGlobal: { max: 120, seconds: day, global: true },
  social: { max: 45, seconds: minute, global: false },
  profile: { max: 15, seconds: 10 * minute, global: false },
} as const;

export type LimitPolicy = keyof typeof policies;

// Fixed slots bound the table even if the network sees many distinct addresses.
// A collision conservatively shares the allowance. No account ID or IP is stored.
function identitySlot(policy: LimitPolicy, identity: string) {
  if (policies[policy].global) return 0;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("A rate limit key is required.");
  return createHmac("sha256", secret).update(policy).update("\0").update(identity)
    .digest().readUInt16BE(0) % 16_384;
}

const blockedUntil = new Map<string, number>();
let nextErrorLog = 0;

// Only cache refusals. Every approval, including concurrent requests on different
// Vercel instances, spends its allowance in the same PostgreSQL statement.
export async function takeLimit(policy: LimitPolicy, identity: string): Promise<boolean> {
  const started = Date.now();
  try {
    const slot = identitySlot(policy, identity);
    const key = `${policy}:${slot}`;
    if ((blockedUntil.get(key) ?? 0) > started) return false;
    blockedUntil.delete(key);
    const { max, seconds } = policies[policy];
    const [result] = await getDatabase().$queryRaw<{ allowed: boolean; retryMs: number }[]>(Prisma.sql`
      WITH blocked AS (
        SELECT expires_at FROM write_rate_limits
        WHERE policy = ${policy} AND slot = ${slot} AND used >= ${max}
          AND expires_at > statement_timestamp()
      ), accepted AS (
        INSERT INTO write_rate_limits AS bucket (policy, slot, used, expires_at)
        SELECT ${policy}, ${slot}, 1, statement_timestamp() + ${seconds} * interval '1 second'
        WHERE NOT EXISTS (SELECT 1 FROM blocked)
        ON CONFLICT (policy, slot) DO UPDATE SET
          used = CASE WHEN bucket.expires_at <= statement_timestamp() THEN 1 ELSE bucket.used + 1 END,
          expires_at = CASE WHEN bucket.expires_at <= statement_timestamp() THEN EXCLUDED.expires_at ELSE bucket.expires_at END
        WHERE bucket.expires_at <= statement_timestamp() OR bucket.used < ${max}
        RETURNING 1
      )
      SELECT EXISTS (SELECT 1 FROM accepted) AS allowed,
             COALESCE((SELECT floor(extract(epoch FROM (expires_at - statement_timestamp())) * 1000)::int
                       FROM blocked), 0) AS "retryMs"
    `);
    if (!result.allowed && result.retryMs > 0) {
      if (blockedUntil.size >= 512) blockedUntil.delete(blockedUntil.keys().next().value!);
      blockedUntil.set(key, started + Math.min(result.retryMs, 30_000));
    }
    return result.allowed;
  } catch {
    if (started >= nextErrorLog) {
      console.error("The database write rate limiter is unavailable.");
      nextErrorLog = started + 60_000;
    }
    return false;
  }
}

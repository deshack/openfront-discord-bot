import { APIEntitlement } from "discord-api-types/v10";

export interface PremiumOverride {
  guild_id: string;
  reason: string;
  granted_by: string;
  created_at: number;
  expires_at: number | null;
}

export interface PremiumCheckResult {
  isPremium: boolean;
  source: "override" | "entitlement" | null;
}

export async function checkPremiumOverride(
  db: D1Database,
  guildId: string,
): Promise<PremiumOverride | null> {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `SELECT * FROM premium_overrides
       WHERE guild_id = ?
       AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .bind(guildId, now)
    .first<PremiumOverride>();

  return result ?? null;
}

export function checkEntitlements(
  entitlements: APIEntitlement[],
  skuId: string,
  guildId: string,
): boolean {
  return entitlements.some(
    (entitlement) =>
      entitlement.sku_id === skuId && entitlement.guild_id === guildId,
  );
}

export async function checkPremium(
  db: D1Database,
  skuId: string,
  guildId: string,
  entitlements: APIEntitlement[],
): Promise<PremiumCheckResult> {
  const override = await checkPremiumOverride(db, guildId);
  if (override) {
    return { isPremium: true, source: "override" };
  }

  if (checkEntitlements(entitlements, skuId, guildId)) {
    return { isPremium: true, source: "entitlement" };
  }

  return { isPremium: false, source: null };
}

export async function checkPremiumForScheduled(
  db: D1Database,
  token: string,
  appId: string,
  skuId: string,
  guildId: string,
): Promise<PremiumCheckResult> {
  const override = await checkPremiumOverride(db, guildId);
  if (override) {
    return { isPremium: true, source: "override" };
  }

  const response = await fetch(
    `https://discord.com/api/v10/applications/${appId}/entitlements?guild_id=${guildId}&sku_ids=${skuId}`,
    {
      headers: {
        Authorization: `Bot ${token}`,
      },
    },
  );

  if (!response.ok) {
    console.error(
      `Failed to fetch entitlements for guild ${guildId}:`,
      response.status,
    );
    return { isPremium: false, source: null };
  }

  const entitlements = (await response.json()) as APIEntitlement[];
  if (entitlements.length > 0) {
    return { isPremium: true, source: "entitlement" };
  }

  return { isPremium: false, source: null };
}

export async function grantPremiumOverride(
  db: D1Database,
  guildId: string,
  reason: string,
  grantedBy: string,
  expiresAt?: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO premium_overrides (guild_id, reason, granted_by, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET
         reason = excluded.reason,
         granted_by = excluded.granted_by,
         expires_at = excluded.expires_at`,
    )
    .bind(guildId, reason, grantedBy, expiresAt ?? null)
    .run();
}

export async function revokePremiumOverride(
  db: D1Database,
  guildId: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM premium_overrides WHERE guild_id = ?`)
    .bind(guildId)
    .run();

  return result.meta.changes > 0;
}

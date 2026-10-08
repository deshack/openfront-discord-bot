-- Discord users who don't want to be pinged in win announcements. Kept
-- separate from player_registrations so the preference also covers legacy
-- username mappings and survives unregistering/re-registering.
CREATE TABLE mention_opt_outs (
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, discord_user_id)
);

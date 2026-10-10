-- Server-wide settings managed by server admins via /setup.
-- mentions_enabled: when 0, win announcements never ping anyone in the guild,
-- regardless of each player's own preference in mention_opt_outs.
CREATE TABLE guild_settings (
  guild_id TEXT PRIMARY KEY,
  mentions_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

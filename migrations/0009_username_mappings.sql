CREATE TABLE username_mappings (
  guild_id TEXT NOT NULL,
  username TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, username)
);

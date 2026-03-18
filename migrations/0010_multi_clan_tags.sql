-- Recreate guild_configs with composite PRIMARY KEY (guild_id, clan_tag)
-- to support multiple clan tag subscriptions per guild.

CREATE TABLE guild_configs_new (
  guild_id   TEXT    NOT NULL,
  clan_tag   TEXT    NOT NULL,
  channel_id TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, clan_tag)
);

INSERT INTO guild_configs_new
  SELECT guild_id, clan_tag, channel_id, created_at, updated_at
  FROM guild_configs;

DROP TABLE guild_configs;
ALTER TABLE guild_configs_new RENAME TO guild_configs;

CREATE TABLE guild_channel_configs (
  guild_id    TEXT    NOT NULL,
  win_type    TEXT    NOT NULL,
  channel_id  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, win_type)
);

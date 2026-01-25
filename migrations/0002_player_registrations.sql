CREATE TABLE IF NOT EXISTS player_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(guild_id, discord_user_id)
);

CREATE INDEX idx_player_registrations_guild ON player_registrations(guild_id);

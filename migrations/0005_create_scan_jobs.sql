CREATE TABLE IF NOT EXISTS scan_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    clan_tag TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    started_at INTEGER,
    completed_at INTEGER,
    -- Progress tracking for clan wins
    clan_games TEXT,
    clan_games_processed INTEGER DEFAULT 0,
    clan_players_recorded INTEGER DEFAULT 0,
    -- Progress tracking for FFA wins
    ffa_player_ids TEXT,
    ffa_player_index INTEGER DEFAULT 0,
    ffa_wins_processed INTEGER DEFAULT 0,
    -- Error handling
    error_message TEXT
);

CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_guild_id ON scan_jobs(guild_id);

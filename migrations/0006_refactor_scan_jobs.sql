DROP TABLE IF EXISTS scan_jobs;

CREATE TABLE IF NOT EXISTS scan_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    clan_tag TEXT,
    job_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    started_at INTEGER,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
);

CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_guild_id ON scan_jobs(guild_id);

CREATE TABLE IF NOT EXISTS scan_job_clan_sessions (
    scan_job_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    score INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    error_message TEXT,
    PRIMARY KEY (scan_job_id, game_id)
);

CREATE INDEX idx_scan_job_clan_sessions_status ON scan_jobs(status);

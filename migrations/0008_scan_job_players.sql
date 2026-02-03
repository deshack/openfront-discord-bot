-- Track players to process (discovery phase)
CREATE TABLE IF NOT EXISTS scan_job_players (
    scan_job_id INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at INTEGER,
    completed_at INTEGER,
    error_message TEXT,
    PRIMARY KEY (scan_job_id, player_id)
);

CREATE INDEX idx_scan_job_players_status ON scan_job_players(status);

-- Track unique FFA games to verify (processing phase)
CREATE TABLE IF NOT EXISTS scan_job_ffa_games (
    scan_job_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at INTEGER,
    completed_at INTEGER,
    error_message TEXT,
    PRIMARY KEY (scan_job_id, game_id)
);

CREATE INDEX idx_scan_job_ffa_games_status ON scan_job_ffa_games(status);

-- Add date range columns to scan_jobs for player jobs
ALTER TABLE scan_jobs ADD COLUMN start_date TEXT;
ALTER TABLE scan_jobs ADD COLUMN end_date TEXT;

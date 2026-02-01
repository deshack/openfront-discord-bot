CREATE TABLE IF NOT EXISTS premium_overrides (
    guild_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER
);

CREATE INDEX idx_premium_overrides_expires ON premium_overrides(expires_at);

-- player_registrations had no index on player_id, so every FFA-queue lookup
-- (getRegistrationsByPlayerId / updateLastSeenUsername, called once per
-- registered player on every 5-minute cron tick) did a full table scan.
CREATE INDEX idx_player_registrations_player_id ON player_registrations(player_id);

-- The leaderboard's all_time query groups/window-partitions by
-- COALESCE(public_id, username) with no time filter, so it scanned and
-- sorted the entire player_stats table on every /rank view. An expression
-- index on the same grouping key lets SQLite use an index scan instead.
CREATE INDEX idx_player_stats_guild_identity ON player_stats(guild_id, COALESCE(public_id, username), game_start);

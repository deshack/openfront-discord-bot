ALTER TABLE player_stats ADD COLUMN public_id TEXT;

CREATE INDEX idx_player_stats_guild_public_id ON player_stats(guild_id, public_id);

-- Best-effort backfill: chain the legacy username_mappings (username -> discord user)
-- with player_registrations (discord user -> player_id, now used as public_id) so
-- historical wins merge with a player's future publicID-keyed identity where possible.
UPDATE player_stats
SET public_id = (
  SELECT pr.player_id
  FROM username_mappings um
  JOIN player_registrations pr
    ON pr.guild_id = um.guild_id AND pr.discord_user_id = um.discord_user_id
  WHERE um.guild_id = player_stats.guild_id
    AND LOWER(um.username) = LOWER(player_stats.username)
  LIMIT 1
)
WHERE public_id IS NULL;

-- The 0012 backfill only chained the legacy username_mappings table, so it
-- missed legacy (pre-public_id) player_stats rows for anyone who registered
-- without ever having a username_mappings entry. Re-run the merge using every
-- username we now know belongs to a registered player: their cached profile
-- username, their last-seen in-game username, and (as before) any legacy
-- username_mappings entry tied to their Discord account.
UPDATE player_stats
SET public_id = (
  SELECT pr.player_id
  FROM player_registrations pr
  WHERE pr.guild_id = player_stats.guild_id
    AND (
      LOWER(pr.profile_username) = LOWER(player_stats.username)
      OR LOWER(pr.last_seen_username) = LOWER(player_stats.username)
      OR EXISTS (
        SELECT 1 FROM username_mappings um
        WHERE um.guild_id = pr.guild_id
          AND um.discord_user_id = pr.discord_user_id
          AND LOWER(um.username) = LOWER(player_stats.username)
      )
    )
  LIMIT 1
)
WHERE public_id IS NULL;

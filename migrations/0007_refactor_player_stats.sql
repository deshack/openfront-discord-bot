DROP TABLE IF EXISTS player_stats;

CREATE TABLE IF NOT EXISTS player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      username TEXT NOT NULL,
      game_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      score INTEGER NOT NULL,
      game_start INTEGER NOT NULL,
      UNIQUE(guild_id, username, game_id)
  );

CREATE INDEX idx_player_stats_guild ON player_stats(guild_id);
CREATE INDEX idx_player_stats_game_start ON player_stats(game_start);
CREATE INDEX idx_player_stats_guild_username ON player_stats(guild_id, username);

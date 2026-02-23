import ffa from "./ffa";
import game from "./game";
import gameDeaths from "./game-deaths";
import help from "./help";
import inGameName from "./in-game-name";
import info from "./info";
import leaderboard from "./leaderboard";
import ping from "./ping";
import rank from "./rank";
import scanWins from "./scan-wins";
import setup from "./setup";

export const commands = {
  ffa,
  game,
  "game-deaths": gameDeaths,
  help,
  "in-game-name": inGameName,
  ping,
  leaderboard,
  info,
  rank,
  "scan-wins": scanWins,
  setup,
};

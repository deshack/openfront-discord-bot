import ffa from "./ffa";
import info from "./info";
import leaderboard from "./leaderboard";
import ping from "./ping";
import rank from "./rank";
import scanWins from "./scan-wins";
import setup from "./setup";

export const commands = {
  ffa,
  ping,
  leaderboard,
  info,
  rank,
  "scan-wins": scanWins,
  setup,
};

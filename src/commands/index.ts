import deleteGameRecord from "./delete-game-record";
import ffa from "./ffa";
import game from "./game";
import gameDeaths from "./game-deaths";
import help from "./help";
import inGameName from "./in-game-name";
import info from "./info";
import ping from "./ping";
import player from "./player";
import rank from "./rank";
import scanWins from "./scan-wins";
import setup from "./setup";
import triggerWins from "./trigger-wins";
import whois from "./whois";

export const commands = {
  "Delete Game Record": deleteGameRecord,
  ffa,
  game,
  "game-deaths": gameDeaths,
  help,
  "in-game-name": inGameName,
  ping,
  info,
  player,
  rank,
  "scan-wins": scanWins,
  setup,
  "trigger-wins": triggerWins,
  whois,
};

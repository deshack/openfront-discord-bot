import type {
  LeaderboardPeriod,
  MonthContext,
  RankingType,
  WeekContext,
} from "../util/stats";

export type ClanWinsMessage = {
  clanTags: string[];
  start: string;
  end: string;
};

export type FFAWinsMessage = {
  playerIds: string[];
  start: string;
  end: string;
};

export type ScanWinsMessage = {
  guildId: string;
  channelId: string;
  clanTag: string;
  startDate: string;
  endDate: string;
};

export type RankRenderMessage = {
  guildId: string;
  period: LeaderboardPeriod;
  page: number;
  monthContext?: MonthContext;
  weekContext?: WeekContext;
  rankingType: RankingType;
  interactionToken: string;
};

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

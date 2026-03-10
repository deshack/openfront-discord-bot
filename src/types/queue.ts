export type ClanWinsMessage = {
  type: 'clan';
  clanTag: string;
  start: string;
  end: string;
};

export type FFAWinsMessage = {
  type: 'ffa';
  playerId: string;
  start: string;
  end: string;
};

export type WinsQueueMessage = ClanWinsMessage | FFAWinsMessage;

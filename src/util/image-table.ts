export interface LeaderboardRow {
  rank: number;
  username: string;
  wins: number;
  teamWins: number;
  ffaWins: number;
  points: number;
}

function getMedalEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

export async function generateLeaderboardImage(
  rows: LeaderboardRow[],
): Promise<ArrayBuffer> {
  const rowHeight = 36;
  const headerHeight = 44;
  const padding = 16;
  const tableHeight = headerHeight + rows.length * rowHeight + padding * 2;

  const html = `
    <div style="display: flex; flex-direction: column; width: 600px; background-color: #1e1e2e; padding: ${padding}px; font-family: Inter, sans-serif;">
      <div style="display: flex; height: ${headerHeight}px; background: linear-gradient(135deg, #ffd700, #ffb700); border-radius: 8px 8px 0 0; align-items: center; padding: 0 12px;">
        <span style="width: 40px; color: #1e1e2e; font-weight: 700; font-size: 14px; text-align: center;">#</span>
        <span style="flex: 1; color: #1e1e2e; font-weight: 700; font-size: 14px;">Player</span>
        <span style="width: 50px; color: #1e1e2e; font-weight: 700; font-size: 14px; text-align: right;">Wins</span>
        <span style="width: 50px; color: #1e1e2e; font-weight: 700; font-size: 14px; text-align: right;">Team</span>
        <span style="width: 50px; color: #1e1e2e; font-weight: 700; font-size: 14px; text-align: right;">FFA</span>
        <span style="width: 70px; color: #1e1e2e; font-weight: 700; font-size: 14px; text-align: right;">Points</span>
      </div>
      ${rows
        .map((row, index) => {
          const bgColor = index % 2 === 0 ? "#2a2a3e" : "#252535";
          const isLast = index === rows.length - 1;
          const borderRadius = isLast ? "0 0 8px 8px" : "0";
          return `
          <div style="display: flex; height: ${rowHeight}px; background-color: ${bgColor}; align-items: center; padding: 0 12px; border-radius: ${borderRadius};">
            <span style="width: 40px; color: #ffffff; font-size: 14px; text-align: center;">${getMedalEmoji(row.rank)}</span>
            <span style="flex: 1; color: #ffffff; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(row.username)}</span>
            <span style="width: 50px; color: #ffffff; font-size: 14px; text-align: right;">${row.wins}</span>
            <span style="width: 50px; color: #a0a0b0; font-size: 14px; text-align: right;">${row.teamWins}</span>
            <span style="width: 50px; color: #a0a0b0; font-size: 14px; text-align: right;">${row.ffaWins}</span>
            <span style="width: 70px; color: #ffd700; font-size: 14px; text-align: right; font-weight: 600;">${row.points.toLocaleString("en-US")}</span>
          </div>
        `;
        })
        .join("")}
    </div>
  `;

  const { ImageResponse } = await import("workers-og");

  const response = new ImageResponse(html, {
    width: 600,
    height: tableHeight,
  });

  return response.arrayBuffer();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

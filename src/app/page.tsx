import LeaderboardApp from "@/components/LeaderboardApp";
import { getLeaderboard } from "@/lib/leaderboard-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialState = await getLeaderboard();

  return <LeaderboardApp initialState={initialState} />;
}

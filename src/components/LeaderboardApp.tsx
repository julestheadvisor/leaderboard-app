"use client";

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";

type ScoreEntry = {
  id: string;
  groupId: string;
  value: number;
  createdAt: string;
};

type LeaderboardGroup = {
  id: string;
  name: string;
  createdAt: string;
  rank: number;
  totalScore: number;
  scoreCount: number;
  lastScore: number | null;
  lastScoredAt: string | null;
};

type LeaderboardState = {
  groups: LeaderboardGroup[];
  scores: ScoreEntry[];
  updatedAt: string;
};

type ConnectionState = "connecting" | "connected" | "reconnecting";
type OpenGroupDetails = (groupId: string) => void;

const emptyState: LeaderboardState = {
  groups: [],
  scores: [],
  updatedAt: new Date(0).toISOString(),
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function ordinal(rank: number) {
  const suffix =
    rank % 100 >= 11 && rank % 100 <= 13
      ? "th"
      : rank % 10 === 1
        ? "st"
        : rank % 10 === 2
          ? "nd"
          : rank % 10 === 3
            ? "rd"
            : "th";

  return `${rank}${suffix}`;
}

function formatScoreDelta(value: number) {
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
}

function podiumRowClass(rank: number) {
  if (rank === 1) {
    return "bg-[#2a2413] shadow-[inset_4px_0_0_#ffd166]";
  }

  if (rank === 2) {
    return "bg-[#202a2f] shadow-[inset_4px_0_0_#cbd5e1]";
  }

  if (rank === 3) {
    return "bg-[#2a1d17] shadow-[inset_4px_0_0_#c58b5b]";
  }

  return "";
}

function rankBadgeClass(rank: number) {
  if (rank === 1) {
    return "border-[#ffd166] bg-[#3a2a08] text-[#ffd166]";
  }

  if (rank === 2) {
    return "border-[#cbd5e1] bg-[#26313a] text-[#e2e8f0]";
  }

  if (rank === 3) {
    return "border-[#c58b5b] bg-[#351d10] text-[#f0b47d]";
  }

  return "border-[#26ffa7]/40 bg-[#112d25] text-[#26ffa7]";
}

const RankingsCard = memo(function RankingsCard({
  groups,
  scoresLength,
  updatedAt,
  onOpenGroupDetails,
}: {
  groups: LeaderboardGroup[];
  scoresLength: number;
  updatedAt: string;
  onOpenGroupDetails: OpenGroupDetails;
}) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRows = useRef(new Map<string, { rect: DOMRect; rank: number; scoreCount: number }>());
  const boostedRow = useRef<HTMLDivElement | null>(null);
  const boostTimeout = useRef<number | null>(null);
  const visibleGroups = useMemo(() => groups.slice(0, 10), [groups]);

  const setRowRef = useCallback(
    (groupId: string) => (node: HTMLDivElement | null) => {
      if (node) {
        rowRefs.current.set(groupId, node);
      } else {
        rowRefs.current.delete(groupId);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const nextRows = new Map<string, { rect: DOMRect; rank: number; scoreCount: number }>();

    for (const group of visibleGroups) {
      const row = rowRefs.current.get(group.id);
      if (row) {
        nextRows.set(group.id, {
          rect: row.getBoundingClientRect(),
          rank: group.rank,
          scoreCount: group.scoreCount,
        });
      }
    }

    const previous = previousRows.current;
    let promotedGroupId: string | null = null;
    let largestRankJump = 0;

    for (const group of visibleGroups) {
      const before = previous.get(group.id);
      const rankJump = before ? before.rank - group.rank : 0;

      if (before && group.scoreCount > before.scoreCount && rankJump > largestRankJump) {
        promotedGroupId = group.id;
        largestRankJump = rankJump;
      }
    }

    const shouldAnimate =
      promotedGroupId !== null &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldAnimate) {
      if (boostTimeout.current) {
        window.clearTimeout(boostTimeout.current);
      }

      if (boostedRow.current) {
        boostedRow.current.style.backgroundColor = "";
        boostedRow.current.style.boxShadow = "";
      }

      boostedRow.current = rowRefs.current.get(promotedGroupId) ?? null;

      if (boostedRow.current) {
        boostedRow.current.style.backgroundColor = "#173629";
        boostedRow.current.style.boxShadow = "0 0 26px rgba(38, 255, 167, 0.22)";
      }

      boostTimeout.current = window.setTimeout(() => {
        if (boostedRow.current) {
          boostedRow.current.style.backgroundColor = "";
          boostedRow.current.style.boxShadow = "";
          boostedRow.current = null;
        }
      }, 900);

      for (const group of visibleGroups) {
        const row = rowRefs.current.get(group.id);
        const before = previous.get(group.id);
        const after = nextRows.get(group.id);

        if (!row || !before || !after) {
          continue;
        }

        const deltaX = before.rect.left - after.rect.left;
        const deltaY = before.rect.top - after.rect.top;

        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
          continue;
        }

        const isPromoted = group.id === promotedGroupId;

        row.style.position = "relative";
        row.style.zIndex = isPromoted ? "2" : "1";
        row.style.transition = "none";
        row.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${isPromoted ? 1.08 : 1})`;

        window.requestAnimationFrame(() => {
          row.style.transition =
            "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background-color 700ms ease, box-shadow 700ms ease";
          row.style.transform = "translate(0, 0) scale(1)";

          window.setTimeout(() => {
            row.style.position = "";
            row.style.zIndex = "";
            row.style.transition = "";
            row.style.transform = "";
          }, 760);
        });
      }
    }

    previousRows.current = nextRows;
  }, [visibleGroups]);

  useEffect(() => {
    return () => {
      if (boostTimeout.current) {
        window.clearTimeout(boostTimeout.current);
      }
      if (boostedRow.current) {
        boostedRow.current.style.backgroundColor = "";
        boostedRow.current.style.boxShadow = "";
      }
    };
  }, []);

  return (
    <div className="overflow-visible rounded-md border border-[#2d463f] bg-[#101820]/95 shadow-lg shadow-black/20">
      <div className="flex flex-col gap-1 border-b border-[#24342f] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-mono text-lg font-bold uppercase text-[#26ffa7]">Rankings</h2>
        <p className="font-mono text-xs text-[#9fb8b0]">
          {groups.length === 0 && scoresLength === 0
            ? "Ready for first entry"
            : `Last update ${formatDateTime(updatedAt)}`}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="grid min-h-72 place-items-center px-4 py-10 text-center">
          <div>
            <h3 className="text-xl font-bold text-white">No groups yet</h3>
            <p className="mt-2 max-w-sm text-sm text-[#9fb8b0]">
              Add the first group to open scoring for the competition.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-visible">
          <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] border-b border-[#24342f] bg-[#17231f] font-mono text-xs font-bold uppercase text-[#26ffa7] sm:grid-cols-[10%_30%_30%_30%]">
            <div className="px-4 py-3">Place</div>
            <div className="px-4 py-3">Group</div>
            <div className="hidden px-4 py-3 sm:block">Total</div>
            <div className="hidden px-4 py-3 sm:block">Latest</div>
          </div>
          <div className="grid gap-1 overflow-visible px-2 py-2 lg:gap-0.5 lg:px-2 lg:py-1.5">
            {visibleGroups.map((group) => (
              <div
                key={group.id}
                ref={setRowRef(group.id)}
                className={`group/row grid cursor-pointer grid-cols-[5.75rem_minmax(0,1fr)] rounded-md border border-[#1f312c] transition-transform duration-200 hover:relative hover:z-10 hover:scale-[1.006] focus:outline-none focus:ring-2 focus:ring-[#26ffa7] focus:ring-offset-2 focus:ring-offset-[#101820] sm:grid-cols-[10%_30%_30%_30%] sm:hover:scale-[1.012] ${podiumRowClass(group.rank)}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenGroupDetails(group.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenGroupDetails(group.id);
                  }
                }}
              >
                <div className="row-span-3 flex items-center px-4 py-3 sm:row-span-1 lg:py-2">
                  <span
                    className={`inline-flex min-w-14 justify-center rounded-md border px-2 py-1 font-mono text-sm font-bold lg:text-xs ${rankBadgeClass(group.rank)}`}
                  >
                    {ordinal(group.rank)}
                  </span>
                </div>
                <div className="flex min-w-0 items-center px-2 pt-3 sm:px-4 sm:py-3 lg:py-2">
                  <div className="min-w-0 break-words font-bold text-white">{group.name}</div>
                </div>
                <div className="flex min-w-0 items-center gap-3 px-2 pb-3 sm:px-4 sm:py-3 lg:py-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#9fb8b0] sm:hidden">
                    Total
                  </span>
                  <div className="min-w-0 text-xl font-black text-[#ffd166] tabular-nums sm:text-2xl lg:text-xl">
                    {group.totalScore.toLocaleString()}
                  </div>
                </div>
                <div className="col-start-2 flex min-w-0 items-center gap-3 px-2 pb-3 sm:col-start-auto sm:px-4 sm:py-3 lg:py-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#9fb8b0] sm:hidden">
                    Latest
                  </span>
                  <div className="min-w-0 text-[#d7fff1] tabular-nums">
                    {group.lastScore === null ? "-" : formatScoreDelta(group.lastScore)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default function LeaderboardApp({
  initialState = emptyState,
}: {
  initialState?: LeaderboardState;
}) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardState>(initialState);
  const [selectedDetailGroupId, setSelectedDetailGroupId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  const selectedDetailGroup = useMemo(
    () => leaderboard.groups.find((group) => group.id === selectedDetailGroupId),
    [leaderboard.groups, selectedDetailGroupId],
  );

  const selectedDetailScores = useMemo(
    () =>
      selectedDetailGroup
        ? leaderboard.scores
            .filter((entry) => entry.groupId === selectedDetailGroup.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [leaderboard.scores, selectedDetailGroup],
  );

  useEffect(() => {
    let isMounted = true;
    let hasOpenedLiveStream = false;

    const refreshLeaderboard = () =>
      fetch("/api/leaderboard")
        .then((response) => response.json())
        .then((state: LeaderboardState) => {
          if (isMounted) {
            setLeaderboard(state);
            setLoadError("");
          }
        });

    refreshLeaderboard().catch(() => {
        if (isMounted) {
          setLoadError("Unable to load the leaderboard.");
        }
      });

    const events = new EventSource("/api/events");

    events.onopen = () => {
      hasOpenedLiveStream = true;
      setConnectionState("connected");
    };
    events.onerror = () => setConnectionState("reconnecting");
    events.onmessage = (event) => {
      const state = JSON.parse(event.data) as LeaderboardState;
      setLeaderboard(state);
      setLoadError("");
    };

    const connectionFallback = window.setTimeout(() => {
      if (!hasOpenedLiveStream && isMounted) {
        setConnectionState("reconnecting");
      }
    }, 4_000);

    const pollingFallback = window.setInterval(() => {
      if (!hasOpenedLiveStream) {
        refreshLeaderboard().catch(() => undefined);
      }
    }, 3_000);

    return () => {
      isMounted = false;
      window.clearTimeout(connectionFallback);
      window.clearInterval(pollingFallback);
      events.close();
    };
  }, []);

  const openGroupDetails = useCallback((groupId: string) => {
    setSelectedDetailGroupId(groupId);
  }, []);

  return (
    <main className="app-shell min-h-screen bg-[#0b0f14] text-[#eefcf6]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:gap-4 lg:px-8 lg:py-4">
        <header className="flex flex-col gap-4 border-b border-[#24342f] bg-[#101820]/90 px-4 py-5 shadow-lg shadow-black/20 lg:flex-row lg:items-end lg:justify-between lg:py-4">
          <div className="max-w-3xl">
            <p className="font-mono text-sm font-semibold uppercase text-[#26ffa7]">
              Competition judging
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-white sm:text-5xl lg:text-4xl">
              Live Leaderboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-[#26ffa7]/40 bg-[#0d1512] px-3 font-mono text-xs font-semibold uppercase text-[#d7fff1]">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connectionState === "connected"
                    ? "bg-[#26ffa7]"
                    : connectionState === "connecting"
                      ? "bg-[#ffd166]"
                      : "bg-[#ff5c7a]"
                }`}
                aria-hidden="true"
              />
              {connectionState === "connected"
                ? "Live sync on"
                : connectionState === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </span>
          </div>
        </header>

        {loadError ? (
          <p className="rounded-md border border-[#ff5c7a]/40 bg-[#2a1018] px-4 py-3 text-sm font-semibold text-[#ffd8df]">
            {loadError}
          </p>
        ) : null}

        <section className="grid items-start gap-4">
          <RankingsCard
            groups={leaderboard.groups}
            scoresLength={leaderboard.scores.length}
            updatedAt={leaderboard.updatedAt}
            onOpenGroupDetails={openGroupDetails}
          />
        </section>
      </section>

      {selectedDetailGroup ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#050806]/90 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-details-title"
        >
          <div className="w-full max-w-lg rounded-md border border-[#2d463f] bg-[#101820] p-5 text-[#eefcf6] shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase text-[#26ffa7]">
                  Current ranking
                </p>
                <h2
                  id="group-details-title"
                  className="mt-1 font-mono text-2xl font-black uppercase text-white"
                >
                  {selectedDetailGroup.name}
                </h2>
              </div>
              <button
                className="h-9 w-9 rounded-md border border-[#2d463f] bg-[#0d1512] text-xl leading-none text-[#9fb8b0] transition hover:border-[#26ffa7] hover:text-[#26ffa7] focus:outline-none focus:ring-2 focus:ring-[#26ffa7] focus:ring-offset-2 focus:ring-offset-[#101820]"
                type="button"
                onClick={() => setSelectedDetailGroupId(null)}
                aria-label="Close"
              >
                x
              </button>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[#24342f] bg-[#0b0f14] p-3">
                <dt className="font-mono text-xs font-bold uppercase text-[#9fb8b0]">Rank</dt>
                <dd className="mt-1 text-2xl font-black text-[#26ffa7]">
                  {ordinal(selectedDetailGroup.rank)}
                </dd>
              </div>
              <div className="rounded-md border border-[#24342f] bg-[#0b0f14] p-3 sm:col-span-2">
                <dt className="font-mono text-xs font-bold uppercase text-[#9fb8b0]">Score</dt>
                <dd className="mt-1 text-2xl font-black text-[#ffd166] tabular-nums">
                  {selectedDetailGroup.totalScore.toLocaleString()}
                </dd>
              </div>
            </dl>

            <section className="mt-5">
              <h3 className="font-mono text-sm font-bold uppercase text-[#d7fff1]">
                Score history
              </h3>
              {selectedDetailScores.length === 0 ? (
                <p className="mt-3 rounded-md border border-[#24342f] bg-[#0b0f14] p-3 text-sm text-[#9fb8b0]">
                  No score history yet.
                </p>
              ) : (
                <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-[#24342f] bg-[#0b0f14]">
                  {selectedDetailScores.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-4 border-b border-[#1f312c] px-3 py-3 last:border-b-0"
                    >
                      <span className="font-mono text-xs text-[#9fb8b0]">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      <span className="font-mono text-sm font-bold text-[#d7fff1] tabular-nums">
                        {formatScoreDelta(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}

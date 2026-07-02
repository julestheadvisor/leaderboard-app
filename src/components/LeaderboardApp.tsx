"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

type ModalMode = "group" | "score" | null;
type ConnectionState = "connecting" | "connected" | "reconnecting";

const emptyState: LeaderboardState = {
  groups: [],
  scores: [],
  updatedAt: new Date(0).toISOString(),
};

function formatTime(value: string | null) {
  if (!value) {
    return "No scores yet";
  }

  return new Intl.DateTimeFormat("en-US", {
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

export default function LeaderboardApp({
  initialState = emptyState,
}: {
  initialState?: LeaderboardState;
}) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardState>(initialState);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(initialState.groups[0]?.id ?? "");
  const [score, setScore] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  const selectedGroup = useMemo(
    () => leaderboard.groups.find((group) => group.id === selectedGroupId),
    [leaderboard.groups, selectedGroupId],
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
            setSelectedGroupId((current) => current || state.groups[0]?.id || "");
          }
        });

    refreshLeaderboard().catch(() => {
        if (isMounted) {
          setError("Unable to load the leaderboard.");
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
      setSelectedGroupId((current) => {
        if (current && state.groups.some((group) => group.id === current)) {
          return current;
        }

        return state.groups[0]?.id || "";
      });
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

  function openModal(mode: Exclude<ModalMode, null>) {
    setError("");
    setModalMode(mode);

    if (mode === "score") {
      setSelectedGroupId((current) => current || leaderboard.groups[0]?.id || "");
    }
  }

  function closeModal() {
    setError("");
    setModalMode(null);
    setGroupName("");
    setScore("");
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to add group.");
      }

      setLeaderboard(body as LeaderboardState);
      closeModal();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add group.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId, score }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to add score.");
      }

      setLeaderboard(body as LeaderboardState);
      closeModal();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add score.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#172026]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#cdd5d1] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-[#2f6f73]">
              Competition judging
            </p>
            <h1 className="mt-1 text-4xl font-bold sm:text-5xl">Live Leaderboard</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cdd5d1] bg-white px-3 text-sm font-semibold text-[#43504a]">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connectionState === "connected"
                    ? "bg-[#2f8f61]"
                    : connectionState === "connecting"
                      ? "bg-[#c6a145]"
                      : "bg-[#c4554d]"
                }`}
                aria-hidden="true"
              />
              {connectionState === "connected"
                ? "Live sync on"
                : connectionState === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </span>
            <button
              className="h-10 rounded-md bg-[#193f4a] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#102f38] focus:outline-none focus:ring-2 focus:ring-[#193f4a] focus:ring-offset-2"
              type="button"
              onClick={() => openModal("group")}
            >
              Add Group
            </button>
            <button
              className="h-10 rounded-md bg-[#b84f2f] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#963f25] focus:outline-none focus:ring-2 focus:ring-[#b84f2f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#bf9b8e]"
              type="button"
              disabled={leaderboard.groups.length === 0}
              onClick={() => openModal("score")}
            >
              Add Score
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-hidden rounded-md border border-[#cdd5d1] bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-[#dce2df] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold">Rankings</h2>
              <p className="text-sm text-[#65716c]">
                {leaderboard.groups.length === 0 && leaderboard.scores.length === 0
                  ? "Ready for first entry"
                  : `Last update ${formatTime(leaderboard.updatedAt)}`}
              </p>
            </div>

            {leaderboard.groups.length === 0 ? (
              <div className="grid min-h-72 place-items-center px-4 py-10 text-center">
                <div>
                  <h3 className="text-xl font-bold">No groups yet</h3>
                  <p className="mt-2 max-w-sm text-sm text-[#65716c]">
                    Add the first group to open scoring for the competition.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-[#eef2ed] text-xs uppercase text-[#53615a]">
                    <tr>
                      <th className="w-24 px-4 py-3 font-bold">Place</th>
                      <th className="px-4 py-3 font-bold">Group</th>
                      <th className="px-4 py-3 text-right font-bold">Total</th>
                      <th className="px-4 py-3 text-right font-bold">Scores</th>
                      <th className="px-4 py-3 text-right font-bold">Latest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5ebe8]">
                    {leaderboard.groups.map((group) => (
                      <tr key={group.id} className="transition hover:bg-[#faf5ef]">
                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex min-w-14 justify-center rounded-md bg-[#193f4a] px-2 py-1 text-sm font-bold text-white">
                            {ordinal(group.rank)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="font-bold">{group.name}</div>
                          <div className="text-sm text-[#65716c]">
                            Last scored {formatTime(group.lastScoredAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right align-middle text-2xl font-bold tabular-nums">
                          {group.totalScore.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          {group.scoreCount}
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          {group.lastScore === null ? "-" : `+${group.lastScore.toLocaleString()}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="rounded-md border border-[#cdd5d1] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Session</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between border-b border-[#e5ebe8] pb-3">
                <dt className="text-[#65716c]">Groups</dt>
                <dd className="font-bold tabular-nums">{leaderboard.groups.length}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-[#e5ebe8] pb-3">
                <dt className="text-[#65716c]">Submitted scores</dt>
                <dd className="font-bold tabular-nums">{leaderboard.scores.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#65716c]">Leader</dt>
                <dd className="max-w-40 truncate font-bold">
                  {leaderboard.groups[0]?.name ?? "None"}
                </dd>
              </div>
            </dl>
          </aside>
        </section>
      </section>

      {modalMode ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#172026]/55 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-md rounded-md bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="modal-title" className="text-xl font-bold">
                  {modalMode === "group" ? "Add Group" : "Add Score"}
                </h2>
                <p className="mt-1 text-sm text-[#65716c]">
                  {modalMode === "group"
                    ? "Create a new competition group."
                    : "Choose a group and submit a score."}
                </p>
              </div>
              <button
                className="h-9 w-9 rounded-md border border-[#cdd5d1] text-xl leading-none text-[#43504a] transition hover:bg-[#eef2ed] focus:outline-none focus:ring-2 focus:ring-[#193f4a] focus:ring-offset-2"
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                x
              </button>
            </div>

            {modalMode === "group" ? (
              <form className="mt-5 grid gap-4" onSubmit={submitGroup}>
                <label className="grid gap-2 text-sm font-bold" htmlFor="group-name">
                  Group name
                  <input
                    id="group-name"
                    className="h-11 rounded-md border border-[#b8c3bd] px-3 text-base font-normal outline-none transition focus:border-[#193f4a] focus:ring-2 focus:ring-[#193f4a]/20"
                    value={groupName}
                    maxLength={80}
                    onChange={(event) => setGroupName(event.target.value)}
                    autoFocus
                  />
                </label>
                {error ? <p className="text-sm font-semibold text-[#b84f2f]">{error}</p> : null}
                <button
                  className="h-11 rounded-md bg-[#193f4a] px-4 text-sm font-bold text-white transition hover:bg-[#102f38] disabled:cursor-not-allowed disabled:bg-[#95a7ad]"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Adding..." : "Submit Group"}
                </button>
              </form>
            ) : (
              <form className="mt-5 grid gap-4" onSubmit={submitScore}>
                <label className="grid gap-2 text-sm font-bold" htmlFor="score-group">
                  Group
                  <select
                    id="score-group"
                    className="h-11 rounded-md border border-[#b8c3bd] bg-white px-3 text-base font-normal outline-none transition focus:border-[#193f4a] focus:ring-2 focus:ring-[#193f4a]/20"
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                  >
                    {leaderboard.groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold" htmlFor="score-value">
                  Score
                  <input
                    id="score-value"
                    className="h-11 rounded-md border border-[#b8c3bd] px-3 text-base font-normal tabular-nums outline-none transition focus:border-[#193f4a] focus:ring-2 focus:ring-[#193f4a]/20"
                    value={score}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    onChange={(event) => setScore(event.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                </label>

                {selectedGroup ? (
                  <p className="text-sm text-[#65716c]">
                    Current total for {selectedGroup.name}:{" "}
                    <span className="font-bold text-[#172026]">
                      {selectedGroup.totalScore.toLocaleString()}
                    </span>
                  </p>
                ) : null}

                {error ? <p className="text-sm font-semibold text-[#b84f2f]">{error}</p> : null}
                <button
                  className="h-11 rounded-md bg-[#b84f2f] px-4 text-sm font-bold text-white transition hover:bg-[#963f25] disabled:cursor-not-allowed disabled:bg-[#bf9b8e]"
                  type="submit"
                  disabled={isSubmitting || !selectedGroupId || !score}
                >
                  {isSubmitting ? "Adding..." : "Submit Score"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

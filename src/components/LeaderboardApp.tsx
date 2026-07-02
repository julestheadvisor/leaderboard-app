"use client";

import { FormEvent, memo, useCallback, useEffect, useMemo, useState } from "react";

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

type ModalMode = "group" | "score" | "editGroup" | "removeGroup" | null;
type ConnectionState = "connecting" | "connected" | "reconnecting";
type OpenModal = (mode: Exclude<ModalMode, null>) => void;

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

function sanitizeScoreInput(value: string) {
  const sign = value.startsWith("-") ? "-" : "";
  const digits = value.replace(/\D/g, "");
  return `${sign}${digits}`;
}

function formatScoreDelta(value: number) {
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
}

function modalTitle(mode: Exclude<ModalMode, null>) {
  switch (mode) {
    case "group":
      return "Add Group";
    case "score":
      return "Add Score";
    case "editGroup":
      return "Edit Group";
    case "removeGroup":
      return "Remove Group";
  }
}

function modalDescription(mode: Exclude<ModalMode, null>) {
  switch (mode) {
    case "group":
      return "Create a new competition group.";
    case "score":
      return "Choose a group and submit a score.";
    case "editGroup":
      return "Choose a group and update its name.";
    case "removeGroup":
      return "Choose a group to delete with all of its scores.";
  }
}

const RankingsCard = memo(function RankingsCard({
  groups,
  scoresLength,
  updatedAt,
}: {
  groups: LeaderboardGroup[];
  scoresLength: number;
  updatedAt: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#2d463f] bg-[#101820]/95 shadow-[0_0_28px_rgba(38,255,167,0.08)]">
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
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left">
            <thead className="border-b border-[#24342f] bg-[#17231f] font-mono text-xs uppercase text-[#26ffa7]">
              <tr>
                <th className="w-[10%] px-4 py-3 font-bold">Place</th>
                <th className="w-[30%] px-4 py-3 font-bold">Group</th>
                <th className="w-[30%] px-4 py-3 font-bold">Total</th>
                <th className="w-[30%] px-4 py-3 font-bold">Latest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f312c]">
              {groups.map((group) => (
                <tr key={group.id} className="transition hover:bg-[#13241e]">
                  <td className="px-4 py-4 align-middle">
                    <span className="inline-flex min-w-14 justify-center rounded-md border border-[#26ffa7]/40 bg-[#112d25] px-2 py-1 font-mono text-sm font-bold text-[#26ffa7] shadow-[0_0_16px_rgba(38,255,167,0.12)]">
                      {ordinal(group.rank)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="font-bold text-white">{group.name}</div>
                  </td>
                  <td className="px-4 py-4 align-middle text-2xl font-black text-[#ffd166] tabular-nums">
                    {group.totalScore.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 align-middle text-[#d7fff1] tabular-nums">
                    {group.lastScore === null ? "-" : formatScoreDelta(group.lastScore)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

const SessionPanel = memo(function SessionPanel({
  groups,
  scoresLength,
  onOpenModal,
}: {
  groups: LeaderboardGroup[];
  scoresLength: number;
  onOpenModal: OpenModal;
}) {
  return (
    <aside className="self-start rounded-md border border-[#2d463f] bg-[#101820]/95 p-4 shadow-[0_0_28px_rgba(255,209,102,0.08)]">
      <h2 className="font-mono text-lg font-bold uppercase text-[#ffd166]">Session</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between border-b border-[#24342f] pb-3">
          <dt className="text-[#9fb8b0]">Groups</dt>
          <dd className="font-bold text-white tabular-nums">{groups.length}</dd>
        </div>
        <div className="flex items-center justify-between border-b border-[#24342f] pb-3">
          <dt className="text-[#9fb8b0]">Submitted scores</dt>
          <dd className="font-bold text-white tabular-nums">{scoresLength}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[#9fb8b0]">Leader</dt>
          <dd className="max-w-40 truncate font-bold text-white">
            {groups[0]?.name ?? "None"}
          </dd>
        </div>
      </dl>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          className="h-10 rounded-md bg-[#26ffa7] px-1 font-mono text-sm font-bold uppercase text-[#07100d] shadow-[0_0_16px_rgba(38,255,167,0.22)] transition hover:bg-[#8dffd4] focus:outline-none focus:ring-2 focus:ring-[#26ffa7] focus:ring-offset-2 focus:ring-offset-[#0b0f14]"
          type="button"
          onClick={() => onOpenModal("group")}
        >
          Add Group
        </button>
        <button
          className="h-10 rounded-md bg-[#ffd166] px-1 font-mono text-sm font-bold uppercase text-[#140f03] shadow-[0_0_16px_rgba(255,209,102,0.2)] transition hover:bg-[#ffe39a] focus:outline-none focus:ring-2 focus:ring-[#ffd166] focus:ring-offset-2 focus:ring-offset-[#0b0f14] disabled:cursor-not-allowed disabled:bg-[#665b3d] disabled:text-[#b7ab86]"
          type="button"
          disabled={groups.length === 0}
          onClick={() => onOpenModal("score")}
        >
          Add Score
        </button>
        <button
          className="h-10 rounded-md bg-[#5eead4] px-1 font-mono text-sm font-bold uppercase text-[#041412] shadow-[0_0_16px_rgba(94,234,212,0.18)] transition hover:bg-[#99f6e4] focus:outline-none focus:ring-2 focus:ring-[#5eead4] focus:ring-offset-2 focus:ring-offset-[#0b0f14] disabled:cursor-not-allowed disabled:bg-[#47625e] disabled:text-[#9db9b4]"
          type="button"
          disabled={groups.length === 0}
          onClick={() => onOpenModal("editGroup")}
        >
          Edit Group
        </button>
        <button
          className="h-10 rounded-md bg-[#ff5c7a] px-1 font-mono text-sm font-bold uppercase text-[#170408] shadow-[0_0_16px_rgba(255,92,122,0.2)] transition hover:bg-[#ff8fa3] focus:outline-none focus:ring-2 focus:ring-[#ff5c7a] focus:ring-offset-2 focus:ring-offset-[#0b0f14] disabled:cursor-not-allowed disabled:bg-[#6a3b45] disabled:text-[#bd9aa2]"
          type="button"
          disabled={groups.length === 0}
          onClick={() => onOpenModal("removeGroup")}
        >
          <span className="whitespace-nowrap">Remove Group</span>
        </button>
      </div>
    </aside>
  );
});

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

  const groupOptions = useMemo(
    () =>
      leaderboard.groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      )),
    [leaderboard.groups],
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

  const openModal = useCallback((mode: Exclude<ModalMode, null>) => {
    setError("");
    setModalMode(mode);

    if (mode === "group") {
      setGroupName("");
    }

    if (mode === "score") {
      setScore("");
    }

    if (mode === "score" || mode === "editGroup" || mode === "removeGroup") {
      const currentGroup = selectedGroup ?? leaderboard.groups[0];
      setSelectedGroupId(currentGroup?.id ?? "");

      if (mode === "editGroup") {
        setGroupName(currentGroup?.name ?? "");
      }
    }
  }, [leaderboard.groups, selectedGroup]);

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

  async function submitEditGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId, name: groupName }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to edit group.");
      }

      setLeaderboard(body as LeaderboardState);
      closeModal();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to edit group.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRemoveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to remove group.");
      }

      const nextState = body as LeaderboardState;
      setLeaderboard(nextState);
      setSelectedGroupId(nextState.groups[0]?.id ?? "");
      closeModal();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to remove group.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] bg-[linear-gradient(rgba(38,255,167,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(38,255,167,0.06)_1px,transparent_1px)] bg-[size:34px_34px] text-[#eefcf6]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#24342f] bg-[#101820]/90 px-4 py-5 shadow-[0_0_35px_rgba(38,255,167,0.08)] lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-sm font-semibold uppercase text-[#26ffa7]">
              Competition judging
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-white sm:text-5xl">
              Live Leaderboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-[#26ffa7]/40 bg-[#0d1512] px-3 font-mono text-xs font-semibold uppercase text-[#d7fff1] shadow-[0_0_18px_rgba(38,255,167,0.14)]">
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

        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <RankingsCard
            groups={leaderboard.groups}
            scoresLength={leaderboard.scores.length}
            updatedAt={leaderboard.updatedAt}
          />
          <SessionPanel
            groups={leaderboard.groups}
            scoresLength={leaderboard.scores.length}
            onOpenModal={openModal}
          />
        </section>
      </section>

      {modalMode ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#050806]/90 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-md rounded-md border border-[#2d463f] bg-[#101820] p-5 text-[#eefcf6] shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="modal-title" className="font-mono text-xl font-bold uppercase text-[#26ffa7]">
                  {modalTitle(modalMode)}
                </h2>
                <p className="mt-1 text-sm text-[#9fb8b0]">
                  {modalDescription(modalMode)}
                </p>
              </div>
              <button
                className="h-9 w-9 rounded-md border border-[#2d463f] bg-[#0d1512] text-xl leading-none text-[#9fb8b0] transition hover:border-[#26ffa7] hover:text-[#26ffa7] focus:outline-none focus:ring-2 focus:ring-[#26ffa7] focus:ring-offset-2 focus:ring-offset-[#101820]"
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                x
              </button>
            </div>

            {modalMode === "group" ? (
              <form className="mt-5 grid gap-4" onSubmit={submitGroup}>
                <label className="grid gap-2 font-mono text-sm font-bold uppercase text-[#d7fff1]" htmlFor="group-name">
                  Group name
                  <input
                    id="group-name"
                    className="h-11 rounded-md border border-[#2d463f] bg-[#0b0f14] px-3 text-base font-normal text-white outline-none transition focus:border-[#26ffa7] focus:ring-2 focus:ring-[#26ffa7]/20"
                    value={groupName}
                    maxLength={80}
                    onChange={(event) => setGroupName(event.target.value)}
                    autoFocus
                  />
                </label>
                {error ? <p className="text-sm font-semibold text-[#ff5c7a]">{error}</p> : null}
                <button
                  className="h-11 rounded-md bg-[#26ffa7] px-4 font-mono text-sm font-bold uppercase text-[#07100d] transition hover:bg-[#8dffd4] disabled:cursor-not-allowed disabled:bg-[#47625e] disabled:text-[#9db9b4]"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Adding..." : "Submit Group"}
                </button>
              </form>
            ) : modalMode === "score" ? (
              <form className="mt-5 grid gap-4" onSubmit={submitScore}>
                <label className="grid gap-2 font-mono text-sm font-bold uppercase text-[#d7fff1]" htmlFor="score-group">
                  Group
                  <select
                    id="score-group"
                    className="h-11 rounded-md border border-[#2d463f] bg-[#0b0f14] px-3 text-base font-normal text-white outline-none transition focus:border-[#26ffa7] focus:ring-2 focus:ring-[#26ffa7]/20"
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                  >
                    {groupOptions}
                  </select>
                </label>

                <label className="grid gap-2 font-mono text-sm font-bold uppercase text-[#d7fff1]" htmlFor="score-value">
                  Score
                  <input
                    id="score-value"
                    className="h-11 rounded-md border border-[#2d463f] bg-[#0b0f14] px-3 text-base font-normal text-white tabular-nums outline-none transition focus:border-[#26ffa7] focus:ring-2 focus:ring-[#26ffa7]/20"
                    value={score}
                    inputMode="text"
                    pattern="-?[0-9]*"
                    autoComplete="off"
                    onChange={(event) => setScore(sanitizeScoreInput(event.target.value))}
                    autoFocus
                  />
                </label>

                {selectedGroup ? (
                  <p className="text-sm text-[#9fb8b0]">
                    Current total for {selectedGroup.name}:{" "}
                    <span className="font-bold text-[#ffd166]">
                      {selectedGroup.totalScore.toLocaleString()}
                    </span>
                  </p>
                ) : null}

                {error ? <p className="text-sm font-semibold text-[#ff5c7a]">{error}</p> : null}
                <button
                  className="h-11 rounded-md bg-[#ffd166] px-4 font-mono text-sm font-bold uppercase text-[#140f03] transition hover:bg-[#ffe39a] disabled:cursor-not-allowed disabled:bg-[#665b3d] disabled:text-[#b7ab86]"
                  type="submit"
                  disabled={isSubmitting || !selectedGroupId || !score || score === "-"}
                >
                  {isSubmitting ? "Adding..." : "Submit Score"}
                </button>
              </form>
            ) : modalMode === "editGroup" ? (
              <form className="mt-5 grid gap-4" onSubmit={submitEditGroup}>
                <label className="grid gap-2 font-mono text-sm font-bold uppercase text-[#d7fff1]" htmlFor="edit-group">
                  Group
                  <select
                    id="edit-group"
                    className="h-11 rounded-md border border-[#2d463f] bg-[#0b0f14] px-3 text-base font-normal text-white outline-none transition focus:border-[#26ffa7] focus:ring-2 focus:ring-[#26ffa7]/20"
                    value={selectedGroupId}
                    onChange={(event) => {
                      const nextGroup = leaderboard.groups.find(
                        (group) => group.id === event.target.value,
                      );
                      setSelectedGroupId(event.target.value);
                      setGroupName(nextGroup?.name ?? "");
                    }}
                  >
                    {groupOptions}
                  </select>
                </label>

                <label className="grid gap-2 font-mono text-sm font-bold uppercase text-[#d7fff1]" htmlFor="edit-group-name">
                  Group name
                  <input
                    id="edit-group-name"
                    className="h-11 rounded-md border border-[#2d463f] bg-[#0b0f14] px-3 text-base font-normal text-white outline-none transition focus:border-[#26ffa7] focus:ring-2 focus:ring-[#26ffa7]/20"
                    value={groupName}
                    maxLength={80}
                    onChange={(event) => setGroupName(event.target.value)}
                    autoFocus
                  />
                </label>

                {selectedGroup ? (
                  <p className="text-sm text-[#9fb8b0]">
                    Current total:{" "}
                    <span className="font-bold text-[#ffd166]">
                      {selectedGroup.totalScore.toLocaleString()}
                    </span>
                  </p>
                ) : null}

                {error ? <p className="text-sm font-semibold text-[#ff5c7a]">{error}</p> : null}
                <button
                  className="h-11 rounded-md bg-[#5eead4] px-4 font-mono text-sm font-bold uppercase text-[#041412] transition hover:bg-[#99f6e4] disabled:cursor-not-allowed disabled:bg-[#47625e] disabled:text-[#9db9b4]"
                  type="submit"
                  disabled={isSubmitting || !selectedGroupId || !groupName.trim()}
                >
                  {isSubmitting ? "Saving..." : "Save Group"}
                </button>
              </form>
            ) : (
              <form className="mt-5 grid gap-4" onSubmit={submitRemoveGroup}>
                <label className="grid gap-2 font-mono text-sm font-bold uppercase text-[#d7fff1]" htmlFor="remove-group">
                  Group
                  <select
                    id="remove-group"
                    className="h-11 rounded-md border border-[#2d463f] bg-[#0b0f14] px-3 text-base font-normal text-white outline-none transition focus:border-[#26ffa7] focus:ring-2 focus:ring-[#26ffa7]/20"
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                  >
                    {groupOptions}
                  </select>
                </label>

                {selectedGroup ? (
                  <div className="rounded-md border border-[#ff5c7a]/40 bg-[#2a1018] px-3 py-2 text-sm text-[#ffd8df]">
                    Removing <span className="font-bold">{selectedGroup.name}</span> will delete{" "}
                    <span className="font-bold tabular-nums">{selectedGroup.scoreCount}</span>{" "}
                    scores.
                  </div>
                ) : null}

                {error ? <p className="text-sm font-semibold text-[#ff5c7a]">{error}</p> : null}
                <button
                  className="h-11 rounded-md bg-[#ff5c7a] px-4 font-mono text-sm font-bold uppercase text-[#170408] transition hover:bg-[#ff8fa3] disabled:cursor-not-allowed disabled:bg-[#6a3b45] disabled:text-[#bd9aa2]"
                  type="submit"
                  disabled={isSubmitting || !selectedGroupId}
                >
                  {isSubmitting ? "Removing..." : "Remove Group"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

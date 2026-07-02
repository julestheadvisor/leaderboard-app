import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type Group = {
  id: string;
  name: string;
  createdAt: string;
};

export type ScoreEntry = {
  id: string;
  groupId: string;
  value: number;
  createdAt: string;
};

export type LeaderboardGroup = Group & {
  rank: number;
  totalScore: number;
  scoreCount: number;
  lastScore: number | null;
  lastScoredAt: string | null;
};

export type LeaderboardState = {
  groups: LeaderboardGroup[];
  scores: ScoreEntry[];
  updatedAt: string;
};

type StoredLeaderboard = {
  groups: Group[];
  scores: ScoreEntry[];
  updatedAt: string;
};

type Subscriber = (state: LeaderboardState) => void;

declare global {
  var leaderboardSubscribers: Set<Subscriber> | undefined;
  var leaderboardWriteQueue: Promise<void> | undefined;
}

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "leaderboard.json");

function initialStore(): StoredLeaderboard {
  return {
    groups: [],
    scores: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStoredData(value: unknown): StoredLeaderboard {
  if (!value || typeof value !== "object") {
    return initialStore();
  }

  const candidate = value as Partial<StoredLeaderboard>;
  return {
    groups: Array.isArray(candidate.groups) ? candidate.groups : [],
    scores: Array.isArray(candidate.scores) ? candidate.scores : [],
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

async function readStore(): Promise<StoredLeaderboard> {
  try {
    const contents = await readFile(dataFile, "utf8");
    return normalizeStoredData(JSON.parse(contents));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return initialStore();
    }

    throw error;
  }
}

async function writeStore(data: StoredLeaderboard) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temporaryFile, dataFile);
}

async function withWriteQueue<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalThis.leaderboardWriteQueue ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  globalThis.leaderboardWriteQueue = previous.then(() => current);
  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}

export function toLeaderboardState(data: StoredLeaderboard): LeaderboardState {
  const scoresByGroup = new Map<string, ScoreEntry[]>();

  for (const score of data.scores) {
    const groupScores = scoresByGroup.get(score.groupId) ?? [];
    groupScores.push(score);
    scoresByGroup.set(score.groupId, groupScores);
  }

  const groups = data.groups
    .map((group) => {
      const groupScores = scoresByGroup.get(group.id) ?? [];
      const totalScore = groupScores.reduce((sum, score) => sum + score.value, 0);
      const latestScore = groupScores.reduce<ScoreEntry | null>((latest, score) => {
        if (!latest || latest.createdAt < score.createdAt) {
          return score;
        }
        return latest;
      }, null);

      return {
        ...group,
        rank: 0,
        totalScore,
        scoreCount: groupScores.length,
        lastScore: latestScore?.value ?? null,
        lastScoredAt: latestScore?.createdAt ?? null,
      };
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }

      if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }

      return a.name.localeCompare(b.name);
    });

  let lastScore: number | null = null;
  let lastRank = 0;

  const rankedGroups = groups.map((group, index) => {
    const rank = group.totalScore === lastScore ? lastRank : index + 1;
    lastScore = group.totalScore;
    lastRank = rank;
    return { ...group, rank };
  });

  return {
    groups: rankedGroups,
    scores: data.scores,
    updatedAt: data.updatedAt,
  };
}

export async function getLeaderboard(): Promise<LeaderboardState> {
  return toLeaderboardState(await readStore());
}

export async function addGroup(name: string): Promise<LeaderboardState> {
  const trimmedName = normalizeGroupName(name);

  validateGroupName(trimmedName);

  const state = await withWriteQueue(async () => {
    const data = await readStore();
    const nameExists = data.groups.some(
      (group) => group.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    );

    if (nameExists) {
      throw new Error("A group with this name already exists.");
    }

    const updated: StoredLeaderboard = {
      ...data,
      groups: [
        ...data.groups,
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    await writeStore(updated);
    return toLeaderboardState(updated);
  });

  publishLeaderboard(state);
  return state;
}

export async function editGroup(groupId: string, name: string): Promise<LeaderboardState> {
  const trimmedName = normalizeGroupName(name);

  validateGroupName(trimmedName);

  const state = await withWriteQueue(async () => {
    const data = await readStore();
    const groupExists = data.groups.some((group) => group.id === groupId);

    if (!groupExists) {
      throw new Error("Choose an existing group before editing.");
    }

    const nameExists = data.groups.some(
      (group) =>
        group.id !== groupId &&
        group.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    );

    if (nameExists) {
      throw new Error("A group with this name already exists.");
    }

    const updated: StoredLeaderboard = {
      ...data,
      groups: data.groups.map((group) =>
        group.id === groupId ? { ...group, name: trimmedName } : group,
      ),
      updatedAt: new Date().toISOString(),
    };

    await writeStore(updated);
    return toLeaderboardState(updated);
  });

  publishLeaderboard(state);
  return state;
}

export async function removeGroup(groupId: string): Promise<LeaderboardState> {
  const state = await withWriteQueue(async () => {
    const data = await readStore();
    const groupExists = data.groups.some((group) => group.id === groupId);

    if (!groupExists) {
      throw new Error("Choose an existing group before removing.");
    }

    const updated: StoredLeaderboard = {
      ...data,
      groups: data.groups.filter((group) => group.id !== groupId),
      scores: data.scores.filter((score) => score.groupId !== groupId),
      updatedAt: new Date().toISOString(),
    };

    await writeStore(updated);
    return toLeaderboardState(updated);
  });

  publishLeaderboard(state);
  return state;
}

export async function addScore(groupId: string, score: string): Promise<LeaderboardState> {
  if (!/^-?\d+$/.test(score)) {
    throw new Error("Score must be a whole number.");
  }

  const value = Number(score);

  if (!Number.isSafeInteger(value)) {
    throw new Error("Score is too large.");
  }

  const state = await withWriteQueue(async () => {
    const data = await readStore();
    const groupExists = data.groups.some((group) => group.id === groupId);

    if (!groupExists) {
      throw new Error("Choose an existing group before submitting a score.");
    }

    const updated: StoredLeaderboard = {
      ...data,
      scores: [
        ...data.scores,
        {
          id: crypto.randomUUID(),
          groupId,
          value,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    await writeStore(updated);
    return toLeaderboardState(updated);
  });

  publishLeaderboard(state);
  return state;
}

function normalizeGroupName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function validateGroupName(name: string) {
  if (name.length < 1) {
    throw new Error("Group name is required.");
  }

  if (name.length > 80) {
    throw new Error("Group name must be 80 characters or fewer.");
  }
}

export function subscribeToLeaderboard(subscriber: Subscriber) {
  const subscribers = (globalThis.leaderboardSubscribers ??= new Set());
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
  };
}

function publishLeaderboard(state: LeaderboardState) {
  const subscribers = globalThis.leaderboardSubscribers;

  if (!subscribers) {
    return;
  }

  for (const subscriber of subscribers) {
    subscriber(state);
  }
}

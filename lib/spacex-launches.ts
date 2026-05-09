import { unstable_cache } from "next/cache";

/** Launch Library 2 — https://thespacedevs.com/ (SpaceX provider id is stable in LL2). */
export const SPACEX_LAUNCH_LIBRARY_PROVIDER_ID = 121;

const LAUNCH_LIBRARY_UPCOMING = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/";

/** Space Devs Patreon key — `Authorization: Token …`. Raises rate limits above ~15 req/hour per IP. */
const launchLibraryRevalidateSec = () =>
  process.env.SPACEDEVS_API_TOKEN?.trim() ? 300 : 3600;

/** Deduplicate parallel requests in one server instance (cold starts still get their own copy). */
let inflightLaunches: Promise<SpaceXLaunchBrief[]> | null = null;
/** Last good manifest so a 429/timeout still returns data when possible. */
let lastGoodLaunches: SpaceXLaunchBrief[] | null = null;

export class LaunchLibraryHttpError extends Error {
  constructor(readonly status: number, message = `Launch Library HTTP ${status}`) {
    super(message);
    this.name = "LaunchLibraryHttpError";
  }
}

type LLNormalLaunch = {
  id: string;
  name: string;
  net: string;
  window_start: string | null;
  window_end: string | null;
  status?: { abbrev?: string; description?: string; name?: string };
  launch_service_provider?: { id?: number; name?: string };
  pad?: {
    name?: string | null;
    location?: { name?: string | null };
  };
  mission?: { description?: string | null; name?: string | null };
};

type LLUpdate = {
  comment?: string;
  info_url?: string;
  created_on?: string;
};

type LLDetailedLaunch = LLNormalLaunch & {
  updates?: LLUpdate[];
  vidURLs?: { url?: string; title?: string }[];
  infoURLs?: { url?: string; title?: string }[];
};

type LLListResponse = {
  results?: LLDetailedLaunch[];
};

export type SpaceXLaunchBrief = {
  id: string;
  name: string;
  net: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Full status title from Launch Library (e.g. "Go for Launch"). */
  statusName: string;
  statusAbbrev: string;
  statusDescription: string;
  padName: string;
  locationName: string;
  missionDescription: string;
  latestUpdate: { comment: string; infoUrl: string | null; createdOn: string } | null;
  webcastUrl: string | null;
  officialUrl: string | null;
};

function launchLibraryHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "kewldashboard/1.0 (+https://github.com/lahmanbrownproductions/kewldashboard)",
  };
  const token = process.env.SPACEDEVS_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Token ${token}`;
  }
  return headers;
}

/** One HTTP call per page — `mode=detailed` includes webcast/update fields (no per-launch detail request). */
async function fetchUpcomingLaunchPage(limit: number, offset: number): Promise<LLDetailedLaunch[]> {
  const params = new URLSearchParams({
    mode: "detailed",
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${LAUNCH_LIBRARY_UPCOMING}?${params}`, {
    headers: launchLibraryHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new LaunchLibraryHttpError(res.status, `Launch Library list ${res.status}`);
  }
  const data = (await res.json()) as LLListResponse;
  return Array.isArray(data.results) ? data.results : [];
}

function normalizeBrief(
  row: LLNormalLaunch,
  detail: LLDetailedLaunch | null,
): SpaceXLaunchBrief {
  const d = detail?.id === row.id ? detail : null;
  const upd = d?.updates?.[0];
  const vid = d?.vidURLs?.find((v) => v.url)?.url ?? null;
  const official = d?.infoURLs?.find((u) => u.url)?.url ?? null;

  const missionDesc =
    typeof row.mission?.description === "string" ? row.mission.description.trim() : "";
  const statusAbbrev = (row.status?.abbrev ?? "—").trim();
  const statusNameRaw = typeof row.status?.name === "string" ? row.status.name.trim() : "";
  const statusName = statusNameRaw || statusAbbrev;
  const statusDescription =
    typeof row.status?.description === "string" ? row.status.description.trim() : "";

  return {
    id: row.id,
    name: row.name,
    net: row.net,
    windowStart: row.window_start ?? null,
    windowEnd: row.window_end ?? null,
    statusName,
    statusAbbrev,
    statusDescription,
    padName: typeof row.pad?.name === "string" ? row.pad.name : "—",
    locationName: typeof row.pad?.location?.name === "string" ? row.pad.location.name : "—",
    missionDescription: missionDesc,
    latestUpdate: upd?.comment
      ? {
          comment: upd.comment.trim(),
          infoUrl: typeof upd.info_url === "string" ? upd.info_url : null,
          createdOn: typeof upd.created_on === "string" ? upd.created_on : "",
        }
      : null,
    webcastUrl: vid,
    officialUrl: official,
  };
}

async function fetchUpcomingSpaceXLaunchesImpl(max = 4): Promise<SpaceXLaunchBrief[]> {
  const collected: LLDetailedLaunch[] = [];
  const seen = new Set<string>();
  const batchSize = 100;

  for (let offset = 0; offset < 200 && collected.length < max + 2; offset += batchSize) {
    const batch = await fetchUpcomingLaunchPage(batchSize, offset);
    if (batch.length === 0) {
      break;
    }
    for (const row of batch) {
      if (row.launch_service_provider?.id !== SPACEX_LAUNCH_LIBRARY_PROVIDER_ID) {
        continue;
      }
      if (seen.has(row.id)) {
        continue;
      }
      seen.add(row.id);
      collected.push(row);
      if (collected.length >= max + 2) {
        break;
      }
    }
    if (batch.length < batchSize) {
      break;
    }
  }

  collected.sort((a, b) => new Date(a.net).getTime() - new Date(b.net).getTime());
  const top = collected.slice(0, max);

  if (top.length === 0) {
    return [];
  }

  return top.map((row) => normalizeBrief(row, row));
}

export function fetchUpcomingSpaceXLaunches(max = 4): Promise<SpaceXLaunchBrief[]> {
  if (inflightLaunches) {
    return inflightLaunches;
  }
  inflightLaunches = (async () => {
    try {
      const data = await unstable_cache(
        () => fetchUpcomingSpaceXLaunchesImpl(max),
        ["kewldashboard-spacex-upcoming", String(max)],
        { revalidate: launchLibraryRevalidateSec(), tags: ["spacex-upcoming"] },
      )();
      lastGoodLaunches = data;
      return data;
    } catch (e) {
      if (lastGoodLaunches?.length) {
        return lastGoodLaunches;
      }
      throw e;
    } finally {
      inflightLaunches = null;
    }
  })();
  return inflightLaunches;
}

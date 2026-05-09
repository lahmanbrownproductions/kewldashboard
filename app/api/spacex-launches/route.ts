import { NextResponse } from "next/server";

import { fetchUpcomingSpaceXLaunches, LaunchLibraryHttpError } from "@/lib/spacex-launches";

export async function GET() {
  try {
    const launches = await fetchUpcomingSpaceXLaunches(4);
    return NextResponse.json({
      launches,
      attribution:
        "Launch data from Launch Library 2 (The Space Devs). T− uses your clock from NET; the manifest syncs occasionally for status or slip updates.",
    });
  } catch (e) {
    if (e instanceof LaunchLibraryHttpError && e.status === 429) {
      return NextResponse.json(
        {
          error:
            "Launch Library rate limit (about 15 requests/hour per IP without a key). The schedule relay backs off automatically — add SPACEDEVS_API_TOKEN for higher limits, or retry shortly.",
          launches: [],
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: "Launch schedule unavailable", launches: [] }, { status: 502 });
  }
}

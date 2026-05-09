import { NextResponse } from "next/server";

import { fetchUpcomingSpaceXLaunches } from "@/lib/spacex-launches";

export async function GET() {
  try {
    const launches = await fetchUpcomingSpaceXLaunches(4);
    return NextResponse.json({
      launches,
      attribution: "Launch data from Launch Library 2 (The Space Devs). Times subject to change — NET.",
    });
  } catch {
    return NextResponse.json({ error: "Launch schedule unavailable", launches: [] }, { status: 502 });
  }
}

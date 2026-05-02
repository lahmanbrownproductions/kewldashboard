import { NextResponse } from "next/server";

type GeocodeHit = {
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ error: "Use at least 2 characters for the place name." }, { status: 400 });
  }

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 kewldashboard/1.0",
      },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Geocoding service unavailable." }, { status: 502 });
    }

    const data = (await response.json()) as { results?: GeocodeHit[] };
    const hit = data.results?.[0];

    if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
      return NextResponse.json({ error: "No place matched that name." }, { status: 404 });
    }

    const parts = [hit.name, hit.admin1].filter(Boolean);
    const label = parts.length > 0 ? parts.join(", ") : [hit.name, hit.country].filter(Boolean).join(", ") || q;

    return NextResponse.json({
      label,
      latitude: hit.latitude,
      longitude: hit.longitude,
      timezone: typeof hit.timezone === "string" ? hit.timezone : null,
    });
  } catch {
    return NextResponse.json({ error: "Geocoding failed." }, { status: 502 });
  }
}

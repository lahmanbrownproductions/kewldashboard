import { APP_MASTHEAD_LABEL } from "@/lib/app-meta";
import { HeroOverview } from "@/components/HeroOverview";
import { CONTROL_PILLS } from "@/lib/dashboard-pills";
import { LocalMapPanels } from "@/components/LocalMapPanels";
import { ClockPanel } from "@/components/ClockPanel";
import { MarketPanel } from "@/components/MarketPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DEFAULT_DASHBOARD_LOCATION } from "@/lib/dashboard-location";
import { LcarsRailHeights } from "@/components/LcarsRailHeights";
import { LcarsRailNav } from "@/components/LcarsRailNav";
import { NewsPanel } from "@/components/NewsPanel";
import { getWeatherReport } from "@/lib/weather";

const commandBars = [
  "masthead-bar-wide masthead-cell-2",
  "masthead-bar-short masthead-cell-2",
  "masthead-bar-long masthead-cell-3",
];

export default async function Home() {
  const weatherReport = await getWeatherReport(DEFAULT_DASHBOARD_LOCATION);

  return (
    <main className="dashboard-shell">
      <LcarsRailHeights />
      <LcarsRailNav />

      <header id="overview" className="hero panel scroll-target">
        <HeroOverview controlPills={CONTROL_PILLS} />
      </header>

      <div className="dashboard-stage">
        <section id="lcars" className="lcars-masthead scroll-target" aria-label="LCARS masthead">
          <span className="masthead-cell masthead-version-bar-left masthead-cell-2" aria-hidden="true" />
          {commandBars.map((className) => (
            <span key={className} className={`masthead-cell ${className}`} aria-hidden="true" />
          ))}
          <div className="masthead-label">{APP_MASTHEAD_LABEL}</div>
          <span className="masthead-cell masthead-version-bar-right masthead-cell-2" aria-hidden="true" />
        </section>

        <div className="dashboard-main">
          <section id="systems" className="top-grid scroll-target" aria-label="Primary systems">
            <ClockPanel />
            <WeatherPanel initialReport={weatherReport} />
            <MarketPanel />
          </section>

          <WatchlistPanel />

          <LocalMapPanels />

          <NewsPanel />
        </div>
      </div>
    </main>
  );
}

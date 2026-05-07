import { APP_MASTHEAD_LABEL } from "@/lib/app-meta";
import { HeroOverview } from "@/components/HeroOverview";
import { DashboardSections } from "@/components/DashboardSections";
import { CONTROL_PILLS } from "@/lib/dashboard-pills";
import { DEFAULT_DASHBOARD_LOCATION } from "@/lib/dashboard-location";
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

        <DashboardSections initialWeatherReport={weatherReport} />
      </div>
    </main>
  );
}

/**
 * telemetry.ts
 * ─────────────
 * Initialises Azure Application Insights for the Terian Services frontend.
 *
 * The connection string is injected at build time via the
 * VITE_APPINSIGHTS_CONNECTION_STRING environment variable (set as a GitHub
 * Actions variable and passed to `npm run build` in deploy-swa.yml).
 *
 * When the variable is absent (local dev), telemetry is silently skipped.
 */

import { ApplicationInsights } from "@microsoft/applicationinsights-web";

const connectionString = import.meta.env
  .VITE_APPINSIGHTS_CONNECTION_STRING as string | undefined;

let appInsights: ApplicationInsights | null = null;

if (connectionString) {
  appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,    // tracks SPA route changes as page views
      disableFetchTracking: false,     // tracks fetch() calls (API requests)
      enableCorsCorrelation: true,     // correlates frontend + backend telemetry
    },
  });

  appInsights.loadAppInsights();
  appInsights.trackPageView();        // record the initial page load
}

export { appInsights };

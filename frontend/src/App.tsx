import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/PrivacyPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import TrustPage from "./pages/TrustPage";

import ProductsPage from "./pages/ProductsPage";
import AwardNominationPage from "./pages/AwardNominationPage";
import IntegritySentinelPage from "./pages/IntegritySentinelPage";

import ServicesPage from "./pages/ServicesPage";
import AIAnalyticsPage from "./pages/AIAnalyticsPage";
import IntegrityFraudPage from "./pages/IntegrityFraudPage";
import DataMiningPage from "./pages/DataMiningPage";
import CloudMigrationPage from "./pages/CloudMigrationPage";
import MLOpsPage from "./pages/MLOpsPage";

type RouteEntry = {
  match: (path: string) => boolean;
  component: () => React.ReactElement;
};

const routes: RouteEntry[] = [
  // Static pages
  { match: (p) => p === "/about", component: AboutPage },
  { match: (p) => p === "/contact", component: ContactPage },
  { match: (p) => p === "/trust", component: TrustPage },
  { match: (p) => p === "/privacy" || p === "/privacy.html", component: PrivacyPage },

  // Products
  { match: (p) => p === "/products" || p === "/products/", component: ProductsPage },
  {
    match: (p) =>
      p === "/products/award-nomination" ||
      // legacy
      p === "/award_nomination",
    component: AwardNominationPage,
  },
  { match: (p) => p === "/products/integrity-sentinel", component: IntegritySentinelPage },

  // Services
  { match: (p) => p === "/services" || p === "/services/", component: ServicesPage },
  { match: (p) => p === "/services/ai-analytics", component: AIAnalyticsPage },
  {
    match: (p) =>
      p === "/services/integrity-fraud" ||
      // legacy
      p === "/systemic_fraud_detection",
    component: IntegrityFraudPage,
  },
  { match: (p) => p === "/services/data-mining", component: DataMiningPage },
  { match: (p) => p === "/services/cloud-migration", component: CloudMigrationPage },
  { match: (p) => p === "/services/mlops", component: MLOpsPage },
];

export default function App() {
  const pathname = window.location.pathname;

  for (const route of routes) {
    if (route.match(pathname)) {
      const Component = route.component;
      return <Component />;
    }
  }

  return <HomePage />;
}

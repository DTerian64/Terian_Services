import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/PrivacyPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import TrustPage from "./pages/TrustPage";
import AskAIPage from "./pages/AskAI";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";

import ProductsPage from "./pages/ProductsPage";

import ServicesPage from "./pages/ServicesPage";
import AIAnalyticsPage from "./pages/AIAnalyticsPage";
import IntegrityFraudPage from "./pages/IntegrityFraudPage";
import DataMiningPage from "./pages/DataMiningPage";
import CloudMigrationPage from "./pages/CloudMigrationPage";
import MLOpsPage from "./pages/MLOpsPage";
import PricingPage from "./pages/PricingPage";
import AwardNominationPricingPage from "./pages/AwardNominationPricingPage";
import ContractServicesPage from "./pages/ContractServicesPage";
import NewEngagementPage from "./pages/NewEngagementPage";

const SITE = "Terian Services";

type RouteEntry = {
  match: (path: string) => boolean;
  component: () => React.ReactElement;
  title: string;
};

const routes: RouteEntry[] = [
  // Static pages
  { match: (p) => p === "/about",                                          component: AboutPage,                 title: "About Us" },
  { match: (p) => p === "/contact",                                        component: ContactPage,               title: "Contact" },
  { match: (p) => p === "/ask-ai",                                         component: AskAIPage,                 title: "Ask AI" },
  { match: (p) => p === "/trust",                                          component: TrustPage,                 title: "Trust & Security" },
  { match: (p) => p === "/pricing" || p === "/pricing/",                   component: PricingPage,               title: "Pricing" },
  { match: (p) => p === "/pricing/award-nomination",                       component: AwardNominationPricingPage,title: "Award Nomination Pricing" },
  { match: (p) => p === "/pricing/contract-services",                      component: ContractServicesPage,      title: "Contract Services" },
  { match: (p) => p === "/engagement/new" || p === "/engagement/new/",     component: NewEngagementPage,         title: "Start an Engagement" },
  { match: (p) => p === "/privacy" || p === "/privacy.html",               component: PrivacyPage,               title: "Privacy Policy" },

  // Jobs
  { match: (p) => p === "/jobs" || p === "/jobs/",                         component: JobsPage,                  title: "Jobs" },
  {
    match: (p) => /^\/jobs\/[^/]+$/.test(p),
    component: () => {
      const jobId = window.location.pathname.replace(/^\/jobs\//, "");
      return <JobDetailPage jobId={jobId} />;
    },
    title: "Job Details",
  },

  // Products
  { match: (p) => p === "/products" || p === "/products/",                 component: ProductsPage,              title: "Products" },

  // Services
  { match: (p) => p === "/services" || p === "/services/",                 component: ServicesPage,              title: "Services" },
  { match: (p) => p === "/services/ai-analytics",                          component: AIAnalyticsPage,           title: "AI Analytics" },
  {
    match: (p) => p === "/services/integrity-fraud" || p === "/systemic_fraud_detection",
    component: IntegrityFraudPage,
    title: "Integrity & Fraud Detection",
  },
  { match: (p) => p === "/services/data-mining",                           component: DataMiningPage,            title: "Data Mining" },
  { match: (p) => p === "/services/cloud-migration",                       component: CloudMigrationPage,        title: "Cloud Migration" },
  { match: (p) => p === "/services/mlops",                                 component: MLOpsPage,                 title: "MLOps & Model Governance" },
];

export default function App() {
  const pathname = window.location.pathname;

  for (const route of routes) {
    if (route.match(pathname)) {
      document.title = `${route.title} | ${SITE}`;
      const Component = route.component;
      return <Component />;
    }
  }

  // Home page — just the site name
  document.title = `${SITE} — AI-Powered Engineering & Analytics`;
  return <HomePage />;
}

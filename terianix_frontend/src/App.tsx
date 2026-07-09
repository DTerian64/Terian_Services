import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/PrivacyPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import TrustPage from "./pages/TrustPage";
import AskAIPage from "./pages/AskAI";

import ProductsPage from "./pages/ProductsPage";
import AwardNominationPage from "./pages/AwardNominationPage";
import IntegritySentinelPage from "./pages/IntegritySentinelPage";

import PricingPage from "./pages/PricingPage";
import AwardNominationPricingPage from "./pages/AwardNominationPricingPage";
import AwardNominationRoiPage from "./pages/AwardNominationRoiPage";
import NewEngagementPage from "./pages/NewEngagementPage";

const SITE = "Terianix";

type RouteEntry = {
  match: (path: string) => boolean;
  component: () => React.ReactElement;
  title: string;
};

const routes: RouteEntry[] = [
  // Static pages
  { match: (p) => p === "/about",                                        component: AboutPage,                  title: "About Us" },
  { match: (p) => p === "/contact",                                      component: ContactPage,                title: "Contact" },
  { match: (p) => p === "/ask-ai",                                       component: AskAIPage,                  title: "Ask AI" },
  { match: (p) => p === "/trust",                                        component: TrustPage,                  title: "Trust & Security" },
  { match: (p) => p === "/pricing" || p === "/pricing/",                 component: PricingPage,                title: "Pricing" },
  { match: (p) => p === "/pricing/award-nomination/roi_calculator",      component: AwardNominationRoiPage,     title: "Award Nomination ROI Calculator" },
  { match: (p) => p === "/pricing/award-nomination",                     component: AwardNominationPricingPage, title: "Award Nomination Pricing" },
  { match: (p) => p.startsWith("/engagement/new"),                        component: NewEngagementPage,          title: "New Engagement" },
  { match: (p) => p === "/privacy" || p === "/privacy.html",             component: PrivacyPage,                title: "Privacy Policy" },

  // Products
  { match: (p) => p === "/products" || p === "/products/",               component: ProductsPage,               title: "Products" },
  {
    match: (p) => p === "/products/award-nomination" || p === "/award_nomination",
    component: AwardNominationPage,
    title: "Award Nomination System",
  },
  { match: (p) => p === "/products/integrity-sentinel",                  component: IntegritySentinelPage,      title: "Integrity Sentinel" },
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
  document.title = `${SITE} — Enterprise SaaS by Terian Services`;
  return <HomePage />;
}

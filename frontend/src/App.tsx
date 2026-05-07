import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/PrivacyPage";
import AwardNominationPage from "./pages/AwardNominationPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import SystemicFraudDetectionPage from "./pages/SystemicFraudDetectionPage";

export default function App() {
  const pathname = window.location.pathname;

  if (pathname === "/privacy" || pathname === "/privacy.html") {
    return <PrivacyPage />;
  }

  if (pathname === "/award_nomination") {
    return <AwardNominationPage />;
  }

  if (pathname === "/systemic_fraud_detection") {
    return <SystemicFraudDetectionPage />;
  }

  if (pathname === "/about") {
    return <AboutPage />;
  }

  if (pathname === "/contact") {
    return <ContactPage />;
  }

  return <HomePage />;
}

import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/PrivacyPage";

export default function App() {
  const pathname = window.location.pathname;

  if (pathname === "/privacy" || pathname === "/privacy.html") {
    return <PrivacyPage />;
  }

  return <HomePage />;
}

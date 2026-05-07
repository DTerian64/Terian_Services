import Header from "../components/Header";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f3f4f6" }}>
      <Header />

      {/* Hero */}
      <section
        style={{
          background: "#111",
          color: "#fff",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.5px",
            marginBottom: "20px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Enterprise HR Automation,{" "}
          <span style={{ color: "#2ab8a8" }}>Simplified</span>
        </h1>
        <p
          style={{
            fontSize: "18px",
            color: "#9ca3af",
            maxWidth: "600px",
            margin: "0 auto 36px",
            lineHeight: 1.7,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Cloud-native platforms that streamline award nominations, recognition, and
          compensation workflows for enterprise organisations — natively integrated
          with Microsoft Azure AD and Workday.
        </p>
        <a
          href="mailto:support@terian-services.com"
          style={{
            display: "inline-block",
            background: "#2ab8a8",
            color: "#000",
            padding: "14px 32px",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textDecoration: "none",
            borderRadius: "2px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          REQUEST A DEMO →
        </a>
      </section>

      {/* Feature tiles */}
      <main id="products" style={{ maxWidth: "1100px", margin: "0 auto", padding: "72px 24px", width: "100%" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "28px",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "48px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Our Products
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          <Tile icon="🏆" title="Award Nominations" color="#2ab8a8" bg="#f0fdfb" border="#b2f0e8">
            Streamlined peer recognition and manager-led award workflows with a full
            audit trail, approval chains, and real-time dashboards.
          </Tile>
          <Tile icon="🔐" title="Azure AD Native" color="#4f46e5" bg="#f5f3ff" border="#c4b5fd">
            Single sign-on for every employee — no extra credentials, no IT overhead.
            B2B guest access for demo and partner environments included out of the box.
          </Tile>
          <Tile icon="💸" title="Workday Integration" color="#0369a1" bg="#f0f9ff" border="#bae6fd">
            Approved awards flow automatically into Workday as compensation events,
            eliminating manual data entry and payroll reconciliation.
          </Tile>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          background: "#000",
          color: "#6b7280",
          textAlign: "center",
          padding: "24px",
          fontSize: "13px",
          fontFamily: "Arial, sans-serif",
          marginTop: "auto",
        }}
      >
        &copy; {new Date().getFullYear()} Terian Services &nbsp;·&nbsp;
        <a href="/privacy" style={{ color: "#9ca3af", textDecoration: "none" }}>
          Privacy Notice
        </a>
      </footer>
    </div>
  );
}

// ── Tile helper ───────────────────────────────────────────────────────────────

function Tile({
  icon, title, color, bg, border, children,
}: {
  icon: string; title: string; color: string; bg: string; border: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "28px" }}>
      <div style={{ fontSize: "28px", marginBottom: "12px" }}>{icon}</div>
      <h3 style={{ fontSize: "17px", fontWeight: 700, color, marginBottom: "10px", fontFamily: "Arial, sans-serif" }}>
        {title}
      </h3>
      <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.7, fontFamily: "Arial, sans-serif" }}>
        {children}
      </p>
    </div>
  );
}

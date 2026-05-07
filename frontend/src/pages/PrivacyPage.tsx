import Header from "../components/Header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f3f4f6" }}>
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-5 py-10 w-full">
        <div className="bg-white rounded-xl shadow-md px-11 py-10">
          <p className="text-xs text-gray-400 mb-8">Effective date: May 2026</p>

          <Section title="1. Who We Are">
            <p>
              This demo environment is operated by{" "}
              <strong>Terian Services</strong>{" "}
              (<a href="https://terian-services.com" className="text-indigo-600 hover:underline">terian-services.com</a>)
              solely for the purpose of demonstrating the Award Nominations SaaS platform to
              prospective customers and partners. It is not a production service and does not
              process real employee data.
            </p>
          </Section>

          <Section title="2. What We Collect">
            <p>When you request demo access we collect:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Your first name, last name, and work email address</li>
              <li>Your IP address (for rate-limiting and abuse prevention)</li>
              <li>Whether you requested administrator access</li>
            </ul>
            <p className="mt-2">
              After you sign in, the demo environment may also store activity you generate
              within the platform (such as nominations you submit), along with the Microsoft
              account identifier assigned to your guest account.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1">
              <li>To create your guest account in the Demo Terian Services Azure AD tenant</li>
              <li>To send you the invitation email needed to access the platform</li>
              <li>To enable sign-in and maintain your session within the demo</li>
              <li>To prevent abuse of the self-registration endpoint</li>
            </ul>
            <p className="mt-2">We do not use your data for marketing, profiling, or advertising purposes.</p>
          </Section>

          <Section title="4. Who We Share It With">
            <p>
              Your invitation is processed through{" "}
              <strong>Microsoft Azure Active Directory B2B</strong>.
              Microsoft receives your email address and display name as part of the guest account
              creation process. We do not sell or share your personal data with any other third party.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <div
              className="rounded-md px-5 py-4 my-4 text-sm"
              style={{ background: "#f5f3ff", borderLeft: "4px solid #4f46e5", color: "#3730a3" }}
            >
              Demo data is retained for the duration of the demo program. You may request
              deletion of your account and associated data at any time by emailing{" "}
              <a href="mailto:support@terian-services.com" className="underline">
                support@terian-services.com
              </a>
              . We will action deletion requests within 7 business days.
            </div>
          </Section>

          <Section title="6. Security">
            <p>
              Access to the demo environment is protected by Microsoft Azure AD authentication.
              Data is stored in Azure SQL Database within the Azure West US 2 region.
              We apply industry-standard controls including encryption at rest and in transit.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@terian-services.com" className="text-indigo-600 hover:underline">
                support@terian-services.com
              </a>
              .
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              For privacy-related questions or concerns, please reach out to:<br />
              <strong>Terian Services</strong><br />
              <a href="mailto:support@terian-services.com" className="text-indigo-600 hover:underline">
                support@terian-services.com
              </a>
            </p>
          </Section>
        </div>

        <footer className="text-center text-xs text-gray-400 mt-8">
          &copy; 2026 Terian Services &nbsp;·&nbsp;
          <a href="/" className="text-gray-500 hover:underline">
            Back to home
          </a>
        </footer>
      </main>
    </div>
  );
}

// ── Internal helper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2
        className="text-sm font-bold text-gray-900 mb-2 pb-1.5"
        style={{ borderBottom: "1px solid #e5e7eb" }}
      >
        {title}
      </h2>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </section>
  );
}

import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function PrivacyPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Legal"
        title="Privacy Notice"
        description="How Terianix.ai collects, uses, and protects your information."
      />

      <div className="border-t border-white/15">
      <main className="mx-auto max-w-2xl px-6 py-16 lg:px-10">
        <p className="text-xs text-slate-400 mb-8">Effective date: May 2026</p>

        <div className="space-y-8">
          <Section title="1. Who We Are">
            <p>
              This site and its associated demo environments are operated by{" "}
              <strong className="text-slate-100">Terianix.ai</strong>{" "}
              (<a href="https://terianix.ai" className="text-violet-400 hover:text-violet-300">terianix.ai</a>).
              Terianix.ai builds AI/ML-empowered SaaS enterprise software products, including the Award
              Nomination System and Integrity Sentinel. This notice covers data we collect through
              this website and through Terianix.ai-operated demo environments.
            </p>
          </Section>

          <Section title="2. What We Collect">
            <p>When you request demo access we collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-300">
              <li>Your first name, last name, and work email address</li>
              <li>Your IP address (for rate-limiting and abuse prevention)</li>
              <li>Whether you requested administrator access</li>
            </ul>
            <p className="mt-3">
              After you sign in, the demo environment may also store activity you generate within
              the platform (such as nominations you submit), along with the Microsoft account
              identifier assigned to your guest account.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>To create your guest account in the Demo Terianix.ai Azure AD tenant</li>
              <li>To send you the invitation email needed to access the platform</li>
              <li>To enable sign-in and maintain your session within the demo</li>
              <li>To prevent abuse of the self-registration endpoint</li>
            </ul>
            <p className="mt-3">We do not use your data for marketing, profiling, or advertising purposes.</p>
          </Section>

          <Section title="4. Who We Share It With">
            <p>
              Your invitation is processed through{" "}
              <strong className="text-slate-100">Microsoft Azure Active Directory B2B</strong>.
              Microsoft receives your email address and display name as part of the guest account
              creation process. We do not sell or share your personal data with any other third party.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <div className="rounded-md border-2 border-white/10 bg-[#0f0d18] px-5 py-4 my-4 text-sm text-slate-300">
              Demo data is retained for the duration of the demo program. You may request deletion
              of your account and associated data at any time by emailing{" "}
              <a href="mailto:support@terian-services.com" className="text-violet-400 hover:text-violet-300 underline">
                support@terian-services.com
              </a>
              . We will action deletion requests within 7 business days.
            </div>
          </Section>

          <Section title="6. Security">
            <p>
              Access to the demo environment is protected by Microsoft Azure AD authentication.
              Data is stored in Azure SQL Database within the Azure West US 2 region. We apply
              industry-standard controls including encryption at rest and in transit.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-300">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@terian-services.com" className="text-violet-400 hover:text-violet-300">
                support@terian-services.com
              </a>
              .
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              For privacy-related questions or concerns, please reach out to:<br />
              <strong className="text-slate-100">Terianix.ai</strong><br />
              <a href="mailto:support@terian-services.com" className="text-violet-400 hover:text-violet-300">
                support@terian-services.com
              </a>
            </p>
          </Section>
        </div>

        <footer className="text-xs text-slate-400 mt-12 pt-6 border-t border-white/10">
          &copy; 2026 Terianix.ai &nbsp;·&nbsp;
          <a href="/" className="text-slate-400 hover:text-slate-200">
            Back to home
          </a>
        </footer>
      </main>
      </div>
    </PageLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-slate-100 mb-3 pb-2 border-b border-white/10">
        {title}
      </h2>
      <div className="text-sm text-slate-300 space-y-2">{children}</div>
    </section>
  );
}

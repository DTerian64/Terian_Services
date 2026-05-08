import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function TrustPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Trust & Security"
        title="Boring on purpose."
        description="The security posture for Terian-operated products and services. For demo environments and SOC controls in detail, contact security@terian-services.com."
      />

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="grid gap-6 sm:grid-cols-2">
          <Card title="Identity" description="Microsoft Azure AD / Entra ID for all user authentication. B2B guest access for partners and demo environments. SSO and MFA enforced." />
          <Card title="Encryption" description="Encryption at rest (Azure-managed keys, customer-managed keys on request) and in transit (TLS 1.2+ everywhere)." />
          <Card title="Hosting region" description="Primary region: Microsoft Azure West US 2. EU/UK landing under evaluation; contact us for current options." />
          <Card title="Network" description="Private endpoints for data services where supported. Public surfaces front-ended by Azure Front Door / Static Web Apps with WAF rules." />
          <Card title="Logging & monitoring" description="Azure Monitor, Log Analytics, Defender for Cloud. Audit logs retained per engagement; export available." />
          <Card title="Access control" description="Least-privilege RBAC, just-in-time elevation via Privileged Identity Management. No standing admin." />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Services engagements</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            Your tenant. Your data. Our discipline.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            For services engagements (AI Analytics, Integrity & Fraud Detection, Data Mining, Cloud
            Migration, MLOps), we typically operate inside the client's Azure tenant under MSA and
            DPA. Sensitive data does not leave the client environment. Engineers are background-checked
            and use ephemeral, MFA-protected access scoped to the engagement.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Compliance posture</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
          Where we are today.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Terian Services builds on the inherited compliance posture of Microsoft Azure (SOC 2, ISO
          27001, HIPAA, FedRAMP — see the Microsoft Trust Center). For our own products, we are
          working toward independent SOC 2 Type II attestation. Specific control documentation is
          available under NDA.
        </p>
      </section>

      <section className="bg-slate-100">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Reporting a vulnerability</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            Found something? Tell us.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Email{" "}
            <a className="font-semibold text-teal-700 hover:text-teal-800" href="mailto:security@terian-services.com">
              security@terian-services.com
            </a>
            . We acknowledge within one business day. We do not pursue researchers acting in good faith.
          </p>
        </div>
      </section>
    </PageLayout>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

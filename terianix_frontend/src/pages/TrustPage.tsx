import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function TrustPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Trust & Security"
        title="Built to be trusted with your data."
        description="The security posture for Terianix.ai-operated products. Built around three commitments: secure, isolated, provable. For SOC controls in detail, contact security@terian-services.com."
      />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
            The three commitments
          </p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Secure. Isolated. Provable.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Card
              title="Secure"
              description="Encryption at rest and in transit, identity-led access, threat-monitored. Defense-in-depth from identity through application."
            />
            <Card
              title="Isolated"
              description="Hard tenant boundaries enforced at the database, identity, and network layers. Your data never crosses into another customer's compute or storage."
            />
            <Card
              title="Provable"
              description="Every state change, approval, and model decision is captured in an immutable audit trail. Exportable, reviewable, defensible."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Controls</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            How we deliver on each.
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card title="Identity" description="Microsoft Azure AD / Entra ID for all user authentication. SSO and MFA enforced. B2B guest access for partners and demo environments — invitation-only, time-bound." />
            <Card title="Encryption" description="Encryption at rest (Azure-managed keys; customer-managed keys on request) and in transit (TLS 1.2+ everywhere). Secrets in Azure Key Vault." />
            <Card title="Defense in depth" description="Layered controls: identity → network → data → application. No single control is the last line. WAF, private endpoints, RBAC, and runtime monitoring all working in concert." />
            <Card title="Tenant isolation" description="Shared-schema architecture enforced with row-level security and identity-scoped storage paths, with dedicated databases available for higher tiers. ML models are tenant-isolated — your data never trains a model used elsewhere." />
            <Card title="Least privilege by default" description="Role-based access control at the application layer — users, admins, and HR business partners in Award Nomination, with product-specific roles for Integrity Sentinel. Each role can see and do only what its function requires." />
            <Card title="Confidentiality of inference" description="For AI features, your prompts, embeddings, and inputs are not used to train cross-tenant models. LLM calls go through tenant-scoped endpoints with logging you control." />
            <Card title="Logging & monitoring" description="Azure Monitor, Log Analytics, and Microsoft Defender for Cloud cover infrastructure and security signals, with anomaly alerts on identity, network, and data-plane activity. Application-level audit trails (see Provable, above) are retained independently and are exportable on request." />
            <Card title="Audit trail (provable)" description="Every nomination, approval, model flag, and configuration change is captured with actor, timestamp, and prior/next state. Exportable for SOX, internal audit, and regulator review." />
            <Card title="Data sovereignty" description="Primary region: Microsoft Azure West US 2. Customer data stays in the elected region. EU / UK / Canada landing zones available on request for regulated workloads." />
          </div>
        </div>
      </section>

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Compliance posture</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Where we are today.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Terianix.ai builds on the inherited compliance posture of Microsoft Azure (SOC 2, ISO
            27001, HIPAA, FedRAMP — see the Microsoft Trust Center). For our own products, we are
            working toward an independent SOC 2 Type II attestation. Specific control documentation is
            available under NDA.
          </p>
        </div>
      </section>

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Reporting a vulnerability</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Found something? Tell us.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Email{" "}
            <a className="font-semibold text-violet-400 hover:text-violet-300" href="mailto:security@terian-services.com">
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
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

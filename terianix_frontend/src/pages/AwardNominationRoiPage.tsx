import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";
import RoiCalculator from "../components/RoiCalculator";

/**
 * Dedicated, deep-linkable home for the ROI calculator
 * (/pricing/award-nomination/roi). Same component as the pricing-page section,
 * so sales can share a focused URL with query-param prefill.
 */
export default function AwardNominationRoiPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="ROI Calculator · Award Nomination"
        title="What's the Award Nomination System worth to you?"
        description="Estimate annual value, net benefit, ROI, and payback in under a minute. Conservative defaults, editable assumptions, and live pricing — built to survive scrutiny, not to hype."
        primaryCta={{ label: "See full pricing", href: "/pricing/award-nomination" }}
        secondaryCta={{ label: "Talk to sales", href: "/contact" }}
      />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <RoiCalculator />
        </div>
      </section>
    </PageLayout>
  );
}

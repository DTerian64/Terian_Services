import PageLayout from "../components/PageLayout";
import RoiCalculator from "../components/RoiCalculator";

/**
 * Dedicated, deep-linkable home for the ROI calculator
 * (/pricing/award-nomination/roi_calculator). Same header as the pricing-page
 * ROI section; the cheesy hero was removed.
 */
export default function AwardNominationRoiPage() {
  return (
    <PageLayout>
      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-400">
            Calculate your ROI
          </p>
          <h1 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            See the value in numbers
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Estimate annual value, net benefit, ROI, and payback in under a minute — conservative
            defaults, editable assumptions, and live pricing.
          </p>
          <div className="mt-8">
            <RoiCalculator />
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

import Header from "../components/Header";

export default function AwardNominationPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Product</p>
        <h1 className="mt-4 text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">Award Nomination System</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
          A structured recognition workflow for employee awards, approvals, audit history, and compensation-ready outcomes.
        </p>
      </main>
    </div>
  );
}

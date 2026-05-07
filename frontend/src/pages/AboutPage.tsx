import Header from "../components/Header";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">About</p>
        <h1 className="mt-4 text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">Terian Services</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
          Terian Services builds practical enterprise systems for recognition, governance, and data-informed operational workflows.
        </p>
      </main>
    </div>
  );
}

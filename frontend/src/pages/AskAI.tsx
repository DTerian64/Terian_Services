import PageLayout from "../components/PageLayout";

const CONVERSATIONS = [
  { title: "345423 finding - explain, t...", date: "Apr 28" },
  { title: "what's the minimum ring s...", date: "Apr 27" },
  { title: "345413", date: "Apr 22" },
  { title: "Show me the top approver...", date: "Apr 20" },
  { title: "Let's take a look at the first...", date: "Apr 18" },
];

export default function AskAIPage() {
  return (
    <PageLayout>
      <section className="bg-slate-50 px-0 py-0 md:px-6 md:py-8">
        <div className="mx-auto min-h-[calc(100vh-5.4rem)] max-w-7xl overflow-hidden border border-slate-200 bg-white shadow-sm md:min-h-[720px] md:rounded-xl">
          <div className="grid min-h-[calc(100vh-5.4rem)] md:min-h-[720px] lg:grid-cols-[30rem_1fr]">
            <aside className="hidden border-r border-slate-200 bg-slate-50 lg:flex lg:flex-col">
              <div className="flex items-center gap-4 border-b border-slate-200 px-6 py-5">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <PaperAirplaneIcon className="h-6 w-6" />
                  New conversation
                </button>
                <button
                  type="button"
                  aria-label="Refresh conversations"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <RefreshIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7">
                <div className="space-y-12">
                  {CONVERSATIONS.map((conversation) => (
                    <a key={`${conversation.title}-${conversation.date}`} href="/ask-ai" className="block">
                      <p className="truncate text-xl font-bold text-slate-800">{conversation.title}</p>
                      <p className="mt-2 text-xl text-slate-400">{conversation.date}</p>
                    </a>
                  ))}
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-col">
              <header className="flex h-24 items-center border-b border-slate-200 px-6 md:px-10">
                <div className="flex items-center gap-4">
                  <PaperAirplaneIcon className="h-8 w-8 text-slate-950" />
                  <h1 className="text-2xl font-bold tracking-normal text-slate-950 md:text-3xl">Ask Analytics AI</h1>
                </div>
              </header>

              <main className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-1 items-center justify-center border-b border-slate-100 px-6 py-16">
                  <div className="text-center">
                    <PaperAirplaneIcon className="mx-auto h-16 w-16 text-slate-200" />
                    <h2 className="mt-10 text-2xl font-bold tracking-normal text-slate-500 md:text-3xl">
                      Ask anything about your nominations
                    </h2>
                    <p className="mt-5 text-xl leading-8 text-slate-400 md:text-2xl">
                      Trends, fraud patterns, graph relationships, exports — all in one conversation.
                    </p>
                  </div>
                </div>

                <div className="px-6 py-6 md:px-10">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                    <textarea
                      disabled
                      rows={2}
                      placeholder="Ask a follow-up or a new question... (Shift+Enter for new line)"
                      className="min-h-[5.5rem] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-6 py-6 text-xl text-slate-500 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-white md:text-2xl"
                    />
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-[5.5rem] items-center justify-center gap-3 rounded-xl bg-slate-300 px-9 text-xl font-bold text-white disabled:cursor-not-allowed"
                    >
                      <PaperAirplaneIcon className="h-7 w-7" />
                      Send
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 text-slate-400 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-lg font-bold text-slate-400 disabled:cursor-not-allowed"
                    >
                      <ShieldIcon className="h-5 w-5" />
                      Investigate
                    </button>
                    <p className="text-lg md:text-xl">Conversations saved automatically</p>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function PaperAirplaneIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M21 3 9.8 14.2M21 3l-7.1 18-4.1-6.8L3 10.1 21 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M20 12a8 8 0 0 1-13.7 5.6M4 12A8 8 0 0 1 17.7 6.4M18 3v4h-4M6 21v-4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 3.5 18 6v5.1c0 3.8-2.5 7.2-6 8.4-3.5-1.2-6-4.6-6-8.4V6l6-2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 15.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

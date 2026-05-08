import PageLayout from "../components/PageLayout";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [];

export default function AskAIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const nextId = useRef(1);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isResponding]);

  useEffect(() => {
    if (!promptRef.current) {
      return;
    }

    promptRef.current.style.height = "auto";
    promptRef.current.style.height = `${Math.min(promptRef.current.scrollHeight, 224)}px`;
  }, [prompt]);

  const startNewConversation = () => {
    nextId.current = 1;
    setMessages(INITIAL_MESSAGES);
    setPrompt("");
    setIsResponding(false);
  };

  const sendPrompt = (value = prompt) => {
    const trimmed = value.trim();
    if (!trimmed || isResponding) {
      return;
    }

    const userMessage: ChatMessage = {
      id: nextId.current++,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setIsResponding(true);

    window.setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: nextId.current++,
        role: "assistant",
        content:
          "I can help with that once the analytics backend is connected. For now, this chat shell is ready to accept questions and preserve the conversation flow.",
      };
      setMessages((current) => [...current, assistantMessage]);
      setIsResponding(false);
    }, 450);
  };

  return (
    <PageLayout hideFooter>
      <section className="bg-slate-50 px-0 py-0 md:px-6 md:py-8">
        <div className="mx-auto min-h-[calc(100vh-5.4rem)] max-w-7xl overflow-hidden border border-slate-200 bg-white shadow-sm md:min-h-[720px] md:rounded-xl">
          <div className="grid min-h-[calc(100vh-5.4rem)] grid-cols-[30%_70%] md:min-h-[720px]">
            <aside className="flex min-w-0 flex-col border-r border-slate-200 bg-slate-50">
              <div className="flex h-24 items-center gap-3 border-b border-slate-200 px-3 md:px-6">
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <PaperAirplaneIcon className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
                  <span className="truncate">New conversation</span>
                </button>
                <button
                  type="button"
                  onClick={startNewConversation}
                  aria-label="Refresh conversations"
                  className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 md:inline-flex"
                >
                  <RefreshIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7" />
            </aside>

            <div className="flex min-w-0 flex-col">
              <header className="flex h-24 items-center border-b border-slate-200 px-6 md:px-10">
                <div className="flex items-center gap-4">
                  <SparkleIcon className="h-8 w-8 text-teal-600" />
                  <h1 className="text-2xl font-bold tracking-normal text-slate-950 md:text-3xl">Ask AI</h1>
                </div>
              </header>

              <main className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto border-b border-slate-100 px-6 py-8 md:px-10">
                  <div className="mx-auto flex max-w-4xl flex-col gap-5">
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}

                    {isResponding ? (
                      <div className="flex items-start gap-3">
                        <Avatar role="assistant" />
                        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-5 py-4 text-slate-500 shadow-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <TypingDot />
                            <TypingDot delayMs={150} />
                            <TypingDot delayMs={300} />
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                <form
                  className="px-6 py-6 md:px-10"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendPrompt();
                  }}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                    <textarea
                      ref={promptRef}
                      rows={3}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          sendPrompt();
                        }
                      }}
                      placeholder="Ask a follow-up or a new question... (Ctrl+Enter to send)"
                      className="max-h-56 min-h-[7rem] flex-1 resize-none overflow-y-auto rounded-xl border border-slate-300 bg-white px-6 py-5 text-[15px] leading-7 text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                    <button
                      type="submit"
                      disabled={!prompt.trim() || isResponding}
                      className="inline-flex min-h-[4.4rem] items-center justify-center gap-3 rounded-xl bg-blue-600 px-9 text-[15px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <PaperAirplaneIcon className="h-7 w-7" />
                      Send
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 text-slate-400 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={() => sendPrompt("Investigate the current nomination data for anomalous patterns.")}
                      disabled={isResponding}
                      className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-[15px] font-bold text-slate-500 transition hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <ShieldIcon className="h-5 w-5" />
                      Investigate
                    </button>
                    <p className="text-[15px]">Conversations saved automatically</p>
                  </div>
                </form>
              </main>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser ? <Avatar role="assistant" /> : null}
      <div
        className={`max-w-[min(42rem,90%)] rounded-2xl px-5 py-4 text-[15px] leading-7 shadow-sm ${
          isUser
            ? "rounded-tr-md bg-blue-600 text-white"
            : "rounded-tl-md border border-slate-200 bg-white text-slate-700"
        }`}
      >
        {message.content}
      </div>
      {isUser ? <Avatar role="user" /> : null}
    </div>
  );
}

function Avatar({ role }: { role: ChatMessage["role"] }) {
  return (
    <div
      className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        role === "assistant" ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-700"
      }`}
    >
      {role === "assistant" ? <SparkleIcon className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
    </div>
  );
}

function TypingDot({ delayMs = 0 }: { delayMs?: number }) {
  return <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" style={{ animationDelay: `${delayMs}ms` }} />;
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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.4 3.1a.75.75 0 0 1 1.2 0l1.9 2.8a.75.75 0 0 0 .5.3l3.2.8a.75.75 0 0 1 .3 1.3l-2.1 1.8a.75.75 0 0 0-.2.7l.5 3.1a.75.75 0 0 1-1.1.8l-3-1.5a.75.75 0 0 0-.7 0l-3 1.5a.75.75 0 0 1-1.1-.8l.5-3.1a.75.75 0 0 0-.2-.7L7 8.3A.75.75 0 0 1 7.3 7l3.2-.8a.75.75 0 0 0 .5-.3l1.4-2.8Z" />
      <path d="M5.2 12.2a.6.6 0 0 1 1 0l.7 1.2a.6.6 0 0 0 .3.3l1.2.7a.6.6 0 0 1 0 1l-1.2.7a.6.6 0 0 0-.3.3l-.7 1.2a.6.6 0 0 1-1 0l-.7-1.2a.6.6 0 0 0-.3-.3L3 15.4a.6.6 0 0 1 0-1l1.2-.7a.6.6 0 0 0 .3-.3l.7-1.2ZM18.6 2.5a.5.5 0 0 1 .8 0l.4.7a.5.5 0 0 0 .2.2l.7.4a.5.5 0 0 1 0 .8l-.7.4a.5.5 0 0 0-.2.2l-.4.7a.5.5 0 0 1-.8 0l-.4-.7a.5.5 0 0 0-.2-.2l-.7-.4a.5.5 0 0 1 0-.8l.7-.4a.5.5 0 0 0 .2-.2l.4-.7Z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
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

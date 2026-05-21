import PageLayout from "../components/PageLayout";
import { useEffect, useRef, useState } from "react";

/**
 * AskAI page
 *
 * The chat shell mirrors the controls, behaviour, and feel of the chatbox
 * in the Award Nomination App's AnalyticsDashboard.tsx "Ask Analytics" tab:
 *
 *   • Left sidebar (w-64) with a "New conversation" pill and refresh button
 *     above a scrollable list of saved conversations.  Double-click an
 *     entry to rename, click ✕ on hover to delete, active conversation
 *     gets a blue highlight.
 *   • Right chat panel:
 *       – Thin header with a Send icon + conversation title.
 *       – Messages area with an empty state, asymmetric-corner bubbles
 *         (blue user / gray assistant, rounded-br-sm vs rounded-bl-sm),
 *         and a three-dot bouncing loader while the assistant is typing.
 *       – Input bar with an auto-resizing textarea (Enter sends,
 *         Shift+Enter inserts a newline), a Send button that turns purple
 *         when Investigate is ON, and a footer row with the Investigate
 *         toggle and a "Conversations saved automatically" hint.
 *
 * No backend yet — conversations live in component state.  When the
 * analytics backend lands, the only changes are: replace the mocked
 * sendPrompt() timeout with a fetch, and swap the in-memory conversation
 * store for the real /api/admin/analytics/conversations endpoints.
 */

type Role = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: Role;
  content: string;
};

type Conversation = {
  conversationId: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Renders plain text with any http/https URLs turned into clickable links. */
function MessageContent({ text, isUser }: { text: string; isUser: boolean }) {
  const linkClass = isUser
    ? "underline text-blue-200 hover:text-white"
    : "underline text-blue-600 hover:text-blue-800";

  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </p>
  );
}

const titleFromQuestion = (q: string) => {
  const cleaned = q.trim().replace(/\s+/g, " ");
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}…` : cleaned || "New conversation";
};

export default function AskAIPage() {
  // ── Conversation state ───────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeConversationRef = useRef<string | null>(null); // safe in async closures

  // ── Chat state ───────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [useOrchestrator, setUseOrchestrator] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const nextMsgId = useRef(1);

  // ── Conversation rename state ────────────────────────────────────────────
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // ── Refs ────────────────────────────────────────────────────────────────
  const chatEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea whenever the question text changes
  useEffect(() => {
    const el = questionInputRef.current;
    if (!el) return;
    el.style.height = "auto"; // shrink first so scrollHeight is accurate
    el.style.height = `${el.scrollHeight}px`;
  }, [aiQuestion]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, aiLoading]);

  // ── Conversation actions ────────────────────────────────────────────────
  const startNewConversation = () => {
    activeConversationRef.current = null;
    setActiveConversationId(null);
    setChatMessages([]);
    setAiQuestion("");
    nextMsgId.current = 1;
    if (questionInputRef.current) {
      questionInputRef.current.style.height = "auto";
      questionInputRef.current.focus();
    }
  };

  const refreshConversations = () => {
    // Local-only stub matching the Analytics dashboard's loader UX.
    setConvLoading(true);
    window.setTimeout(() => setConvLoading(false), 350);
  };

  const loadConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.conversationId === conversationId);
    if (!conv) return;
    activeConversationRef.current = conversationId;
    setActiveConversationId(conversationId);
    setChatMessages(conv.messages);
    // Reset id counter past the highest existing message id
    nextMsgId.current = Math.max(0, ...conv.messages.map((m) => m.id)) + 1;
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const deleteConversation = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.conversationId !== conversationId));
    if (activeConversationRef.current === conversationId) {
      activeConversationRef.current = null;
      setActiveConversationId(null);
      setChatMessages([]);
    }
  };

  const renameConversation = (conversationId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    setEditingConvId(null);
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.conversationId === conversationId ? { ...c, title: trimmed } : c))
    );
  };

  const upsertConversation = (id: string, messages: ChatMessage[], titleSource: string) => {
    setConversations((prev) => {
      const existing = prev.find((c) => c.conversationId === id);
      const now = new Date().toISOString();
      if (existing) {
        return prev.map((c) =>
          c.conversationId === id ? { ...c, messages, updatedAt: now } : c
        );
      }
      return [
        { conversationId: id, title: titleFromQuestion(titleSource), updatedAt: now, messages },
        ...prev,
      ];
    });
  };

  // ── Ask handler ─────────────────────────────────────────────────────────
  const handleAskQuestion = async () => {
    const question = aiQuestion.trim();
    if (!question || aiLoading) return;

    const isInvestigating = useOrchestrator;
    if (isInvestigating) setUseOrchestrator(false); // one-shot — reset immediately

    // Generate / reuse conversation ID synchronously
    let convId = activeConversationRef.current;
    if (!convId) {
      convId = newId();
      activeConversationRef.current = convId;
      setActiveConversationId(convId);
    }

    const userMessage: ChatMessage = {
      id: nextMsgId.current++,
      role: "user",
      content: question,
    };
    // Snapshot history before appending the new user message
    const historyForApi = chatMessages.map(({ role, content }) => ({ role, content }));
    const nextMessages = [...chatMessages, userMessage];

    setChatMessages(nextMessages);
    upsertConversation(convId!, nextMessages, question);
    setAiQuestion("");
    if (questionInputRef.current) {
      questionInputRef.current.style.height = "auto";
      questionInputRef.current.focus();
    }
    setAiLoading(true);

    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historyForApi }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data: { question: string; answer: string; error?: string | null } = await res.json();
      const assistantMessage: ChatMessage = {
        id: nextMsgId.current++,
        role: "assistant",
        content: data.answer || "Sorry, I couldn't generate a response. Please try again.",
      };
      const withAssistant = [...nextMessages, assistantMessage];
      setChatMessages(withAssistant);
      upsertConversation(convId!, withAssistant, question);
    } catch {
      const assistantMessage: ChatMessage = {
        id: nextMsgId.current++,
        role: "assistant",
        content:
          "Sorry, I couldn't reach the server. Please check your connection and try again.",
      };
      const withAssistant = [...nextMessages, assistantMessage];
      setChatMessages(withAssistant);
      upsertConversation(convId!, withAssistant, question);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const activeTitle = activeConversationId
    ? conversations.find((c) => c.conversationId === activeConversationId)?.title ??
      "Conversation"
    : "Ask AI";

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <PageLayout hideFooter darkBg={false}>
      <section className="bg-slate-50 px-0 py-0 md:px-6 md:py-6">
        <div
          className="mx-auto flex max-w-7xl gap-0 overflow-hidden rounded-none border border-gray-200 bg-white shadow-sm md:rounded-lg h-[calc(100vh_-_5.4rem)] md:h-[calc(100vh_-_8.4rem)]"
        >
          {/* ── Conversation sidebar ── */}
          <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-100 bg-gray-50">
            <div className="flex gap-2 border-b border-gray-100 px-3 py-3">
              <button
                type="button"
                onClick={startNewConversation}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <SparkleIcon size={14} />
                New conversation
              </button>
              <button
                type="button"
                onClick={refreshConversations}
                disabled={convLoading}
                title="Refresh conversation list"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40"
              >
                <RefreshIcon size={14} className={convLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {convLoading && (
                <p className="py-4 text-center text-xs text-gray-400">Loading…</p>
              )}
              {!convLoading && conversations.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-gray-400">
                  No conversations yet
                </p>
              )}
              {conversations.map((conv) => (
                <div
                  key={conv.conversationId}
                  onClick={() =>
                    editingConvId !== conv.conversationId &&
                    loadConversation(conv.conversationId)
                  }
                  className={`group mx-1 flex cursor-pointer items-start justify-between gap-1 rounded-lg px-3 py-2 transition-colors ${
                    activeConversationId === conv.conversationId
                      ? "border border-blue-200 bg-blue-50"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {editingConvId === conv.conversationId ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => renameConversation(conv.conversationId, editingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            renameConversation(conv.conversationId, editingTitle);
                          if (e.key === "Escape") setEditingConvId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <p
                        className="truncate text-xs font-medium text-gray-800"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingConvId(conv.conversationId);
                          setEditingTitle(conv.title);
                        }}
                        title="Double-click to rename"
                      >
                        {conv.title}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDay(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteConversation(conv.conversationId, e)}
                    title="Delete conversation"
                    className="mt-0.5 shrink-0 text-gray-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Chat panel ── */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header */}
            <div className="shrink-0 border-b border-gray-100 px-6 py-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <SendIcon size={16} />
                {activeTitle}
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {chatMessages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <SendIcon size={40} className="mb-6 text-gray-300 md:mb-4 md:text-gray-200" />
                  <p className="mb-2 text-xl font-semibold text-gray-800 md:mb-1 md:text-base md:font-medium md:text-gray-500">
                    Ask anything about Terian's products and services
                  </p>
                  <p className="text-sm text-gray-500 md:text-gray-400">
                    Trends, fraud patterns, integrations, security posture — all in one conversation.
                  </p>
                </div>
              )}

              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-3xl rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm bg-gray-100 text-gray-800"
                    }`}
                  >
                    <MessageContent text={msg.content} isUser={msg.role === "user"} />
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
                    <div className="flex h-4 items-center gap-1">
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-gray-100 px-4 py-3 md:px-6 md:py-4">
              {/*
                Mobile layout: outer rounded-2xl border wraps the textarea + action row.
                  Action row inside the box: [+ / Investigate btn] on left, [send circle] on right.
                Desktop layout: transparent flex-row wrapper; textarea has its own border,
                  send button sits beside it.
              */}
              <div className="flex flex-col gap-0 md:flex-row md:items-end md:gap-2">
                {/* Textarea container — provides the outer box border on mobile; md:contents removes it on desktop */}
                <div
                  className="flex flex-1 flex-col rounded-2xl border border-gray-200
                             focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-100
                             md:contents"
                >
                  <textarea
                    ref={questionInputRef}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!aiLoading) handleAskQuestion();
                      }
                    }}
                    placeholder="Ask a question…"
                    rows={1}
                    disabled={aiLoading}
                    className="flex-1 resize-none overflow-hidden bg-transparent px-4 py-3 text-sm
                               leading-relaxed focus:outline-none
                               md:rounded-xl md:border md:border-gray-300 md:bg-white
                               md:focus:border-blue-500 md:focus:ring-2 md:focus:ring-blue-500"
                    style={{ maxHeight: "160px", overflowY: "auto" }}
                  />

                  {/* Mobile-only action row — sits at the bottom inside the bordered box */}
                  <div className="flex items-center justify-between px-3 pb-2 md:hidden">
                    {/* + button: toggles Investigate mode */}
                    <button
                      type="button"
                      onClick={() => setUseOrchestrator((prev) => !prev)}
                      disabled={aiLoading}
                      title="Toggle investigation mode"
                      className={`flex items-center justify-center rounded-full p-1.5 transition-colors disabled:opacity-40 ${
                        useOrchestrator
                          ? "bg-purple-100 text-purple-600"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                    >
                      <PlusIcon size={20} />
                    </button>

                    {/* Send circle button */}
                    <button
                      type="button"
                      onClick={handleAskQuestion}
                      disabled={aiLoading || !aiQuestion.trim()}
                      aria-label="Send message"
                      className={`flex items-center justify-center rounded-full p-2 text-white transition-colors
                                 disabled:cursor-not-allowed disabled:bg-gray-200 ${
                        useOrchestrator
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-gray-900 hover:bg-gray-800"
                      }`}
                    >
                      {aiLoading ? (
                        <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <ArrowUpIcon size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Desktop-only send button — beside the textarea */}
                <button
                  type="button"
                  onClick={handleAskQuestion}
                  disabled={aiLoading || !aiQuestion.trim()}
                  className={`hidden md:flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white transition-colors disabled:bg-gray-300 ${
                    useOrchestrator
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <SendIcon size={16} />
                  {aiLoading
                    ? useOrchestrator
                      ? "Investigating…"
                      : "Thinking…"
                    : "Send"}
                </button>
              </div>

              {/* Footer row: Investigate toggle + hint */}
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUseOrchestrator((prev) => !prev)}
                  disabled={aiLoading}
                  title="Run a deep multi-agent investigation (one-shot — resets after submit)"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                    useOrchestrator
                      ? "border border-purple-300 bg-purple-100 text-purple-700 hover:bg-purple-200"
                      : "border border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <ShieldAlertIcon size={13} />
                  {useOrchestrator ? "Investigate: ON" : "Investigate"}
                </button>
                <p className="text-xs text-gray-400">Conversations saved automatically</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

// ── Inline icons (match lucide-react shapes used in AnalyticsDashboard) ────

type IconProps = { size?: number; className?: string };

function SendIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function RefreshIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" />
    </svg>
  );
}

// Same two-star sparkle path used by the Header's "Ask AI" nav item,
// parameterised here so it can slot into the chat sidebar's button.
function SparkleIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M12.4 3.1a.75.75 0 0 1 1.2 0l1.9 2.8a.75.75 0 0 0 .5.3l3.2.8a.75.75 0 0 1 .3 1.3l-2.1 1.8a.75.75 0 0 0-.2.7l.5 3.1a.75.75 0 0 1-1.1.8l-3-1.5a.75.75 0 0 0-.7 0l-3 1.5a.75.75 0 0 1-1.1-.8l.5-3.1a.75.75 0 0 0-.2-.7L7 8.3A.75.75 0 0 1 7.3 7l3.2-.8a.75.75 0 0 0 .5-.3l1.4-2.8Z" />
      <path d="M5.2 12.2a.6.6 0 0 1 1 0l.7 1.2a.6.6 0 0 0 .3.3l1.2.7a.6.6 0 0 1 0 1l-1.2.7a.6.6 0 0 0-.3.3l-.7 1.2a.6.6 0 0 1-1 0l-.7-1.2a.6.6 0 0 0-.3-.3L3 15.4a.6.6 0 0 1 0-1l1.2-.7a.6.6 0 0 0 .3-.3l.7-1.2ZM18.6 2.5a.5.5 0 0 1 .8 0l.4.7a.5.5 0 0 0 .2.2l.7.4a.5.5 0 0 1 0 .8l-.7.4a.5.5 0 0 0-.2.2l-.4.7a.5.5 0 0 1-.8 0l-.4-.7a.5.5 0 0 0-.2-.2l-.7-.4a.5.5 0 0 1 0-.8l.7-.4a.5.5 0 0 0 .2-.2l.4-.7Z" />
    </svg>
  );
}

function ArrowUpIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function PlusIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ShieldAlertIcon({ size = 13, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

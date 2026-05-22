import PageLayout from "../components/PageLayout";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * AskAI page
 *
 * Visitor identity
 * ────────────────
 * A UUID is generated on the visitor's first ever visit and stored in
 * localStorage ("terian_visitor_id") + a 1-year cookie as fallback.
 * This is the permanent anonymous identity used to associate conversations.
 *
 * Conversation lifecycle
 * ──────────────────────
 * • Page load   — read visitor_id, fetch conversation list from API (sidebar).
 *                 No new conversation is created yet.
 * • First send  — POST /api/conversations (title = first message), then
 *                 POST /api/ask with visitor_id + conversation_id.
 * • New conv btn — clears chat; next send creates a fresh conversation.
 * • Sidebar click — GET /api/conversations/{id}/messages, loads history.
 * • Refresh btn  — re-fetches conversation list.
 *
 * All subsequent sends within the same conversation pass the same
 * conversation_id; the backend appends messages to Cosmos DB.
 *
 * File attachments
 * ────────────────
 * Images only (PNG, JPEG, WEBP, GIF ≤ 4 MB).
 * Three entry points: paperclip button, drag-and-drop onto chat area, or paste.
 * The image is base64-encoded in the browser and sent as file_data + file_type
 * alongside the question. The backend routes it through ImageProcessorAgent
 * before the specialist agent answers.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Visitor ID persistence ────────────────────────────────────────────────────

function getOrCreateVisitorId(): string {
  const KEY = "terian_visitor_id";

  // 1. Try localStorage
  let id = localStorage.getItem(KEY);

  // 2. Fallback: parse from cookie
  if (!id) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`));
    if (match) id = decodeURIComponent(match[1]);
  }

  // 3. Generate fresh UUID
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  // Persist in both stores
  localStorage.setItem(KEY, id);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${KEY}=${encodeURIComponent(id)}; expires=${expires}; path=/; SameSite=Lax`;

  return id;
}

function newConvId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: Role;
  content: string;
  imagePreview?: string;  // data-URI shown in the user bubble when an image was attached
};

type ConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
};

type AttachedFile = {
  /** Raw base64 bytes — no data-URI prefix. Sent to the backend. */
  data: string;
  /** MIME type, e.g. "image/png". */
  type: string;
  /** Original filename shown in the preview strip. */
  name: string;
  /** Full data-URI used for the <img> preview. */
  preview: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const titleFromQuestion = (q: string) => {
  const cleaned = q.trim().replace(/\s+/g, " ");
  return cleaned.length > 120 ? cleaned.slice(0, 117) + "…" : cleaned || "New conversation";
};

/**
 * Renders a chat message.
 *
 * User messages — plain text with clickable URLs (users type plain text).
 * Assistant messages — full markdown via react-markdown + remark-gfm so
 *   headers, bold, bullets, tables, and code blocks all render properly.
 */
function MessageContent({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    // Plain text + URL linkification for user bubbles.
    const URL_RE = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(URL_RE);
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {parts.map((part, i) =>
          URL_RE.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer"
               className="underline text-blue-200 hover:text-white">
              {part}
            </a>
          ) : part
        )}
      </p>
    );
  }

  // Assistant messages — rendered markdown.
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs
        p: ({ children }) => (
          <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        // Headings
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-3 mb-1 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mt-3 mb-1 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5 text-sm">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5 text-sm">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Emphasis
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        // Horizontal rule
        hr: () => <hr className="my-2 border-gray-300" />,
        // Links
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
             className="underline text-blue-600 hover:text-blue-800">
            {children}
          </a>
        ),
        // Inline code
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className={`${className} block`}>{children}</code>
          ) : (
            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs font-mono text-gray-800">
              {children}
            </code>
          );
        },
        // Code blocks
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-lg bg-gray-800 p-3 text-xs text-gray-100 font-mono leading-relaxed">
            {children}
          </pre>
        ),
        // Tables (remark-gfm)
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
        th: ({ children }) => (
          <th className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-xs">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 px-3 py-1.5 text-xs">{children}</td>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 my-2 text-sm">
            {children}
          </blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AskAIPage() {
  // ── Visitor identity (set once, never changes) ───────────────────────────
  const visitorId = useRef<string>(getOrCreateVisitorId());

  // ── Conversation list (sidebar) ──────────────────────────────────────────
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(false);

  // ── Active conversation ──────────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  // true once the active conversation has been persisted via POST /api/conversations
  const conversationCreated = useRef(false);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [useOrchestrator, setUseOrchestrator] = useState(false);
  const nextMsgId = useRef(1);

  // ── File attachment ──────────────────────────────────────────────────────
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Rename state ─────────────────────────────────────────────────────────
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const chatEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = questionInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [aiQuestion]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, aiLoading]);

  // ── File attachment handler ──────────────────────────────────────────────

  const handleFileAttach = useCallback((file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      alert("Only images are supported (PNG, JPEG, WEBP, GIF).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      alert("Image must be smaller than 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // dataUrl format: "data:<mime>;base64,<data>"
      const commaIdx = dataUrl.indexOf(",");
      const header = dataUrl.slice(0, commaIdx);
      const base64Data = dataUrl.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : file.type;
      setAttachedFile({ data: base64Data, type: mime, name: file.name, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  // ── API helpers ──────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/conversations?visitor_id=${encodeURIComponent(visitorId.current)}`
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ConversationSummary[] = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setConvLoading(false);
    }
  }, []);

  // Fetch conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Conversation actions ─────────────────────────────────────────────────

  const startNewConversation = () => {
    activeConversationRef.current = null;
    conversationCreated.current = false;
    setActiveConversationId(null);
    setChatMessages([]);
    setAiQuestion("");
    setAttachedFile(null);
    nextMsgId.current = 1;
    questionInputRef.current?.focus();
    if (questionInputRef.current) questionInputRef.current.style.height = "auto";
  };

  const loadConversation = async (convId: string) => {
    if (convId === activeConversationRef.current) return;
    activeConversationRef.current = convId;
    conversationCreated.current = true; // already exists in DB
    setActiveConversationId(convId);
    setChatMessages([]);
    setAiLoading(false);
    try {
      const res = await fetch(
        `${API_BASE}/api/conversations/${encodeURIComponent(convId)}/messages` +
          `?visitor_id=${encodeURIComponent(visitorId.current)}`
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const msgs: { id: string; role: string; content: string }[] = await res.json();
      nextMsgId.current = 1;
      setChatMessages(
        msgs.map((m) => ({ id: nextMsgId.current++, role: m.role as Role, content: m.content }))
      );
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const renameConversation = (convId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    setEditingConvId(null);
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c))
    );
  };

  // ── Ask handler ──────────────────────────────────────────────────────────

  const handleAskQuestion = async () => {
    const question = aiQuestion.trim() || (attachedFile ? "Please analyze this image." : "");
    if (!question || aiLoading) return;

    const isInvestigating = useOrchestrator;
    if (isInvestigating) setUseOrchestrator(false);

    // Capture the file before clearing state
    const fileSnapshot = attachedFile;

    // ── Ensure we have a conversation ID ────────────────────────────────────
    let convId = activeConversationRef.current;
    if (!convId) {
      convId = newConvId();
      activeConversationRef.current = convId;
      setActiveConversationId(convId);
    }

    // ── Create conversation in DB on first message ───────────────────────────
    if (!conversationCreated.current) {
      conversationCreated.current = true;
      const title = titleFromQuestion(question);
      try {
        await fetch(`${API_BASE}/api/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor_id: visitorId.current, title, id: convId }),
        });
        setConversations((prev) => [
          { id: convId!, title, updated_at: new Date().toISOString() },
          ...prev.filter((c) => c.id !== convId),
        ]);
      } catch (err) {
        console.error("Failed to create conversation:", err);
        conversationCreated.current = false;
      }
    }

    // ── Append user message to chat ──────────────────────────────────────────
    const historyForApi = chatMessages.map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = {
      id: nextMsgId.current++,
      role: "user",
      content: question,
      imagePreview: fileSnapshot?.preview,
    };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setAiQuestion("");
    setAttachedFile(null);
    if (questionInputRef.current) {
      questionInputRef.current.style.height = "auto";
      questionInputRef.current.focus();
    }
    setAiLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: historyForApi,
          visitor_id: visitorId.current,
          conversation_id: convId,
          file_data: fileSnapshot?.data ?? null,
          file_type: fileSnapshot?.type ?? null,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: { answer: string; error?: string | null } = await res.json();

      const assistantMessage: ChatMessage = {
        id: nextMsgId.current++,
        role: "assistant",
        content: data.answer || "Sorry, I couldn't generate a response. Please try again.",
      };
      setChatMessages([...nextMessages, assistantMessage]);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c
        )
      );
    } catch {
      setChatMessages([
        ...nextMessages,
        {
          id: nextMsgId.current++,
          role: "assistant",
          content: "Sorry, I couldn't reach the server. Please check your connection and try again.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeTitle =
    activeConversationId
      ? conversations.find((c) => c.id === activeConversationId)?.title ?? "Conversation"
      : "Ask AI";

  const canSend = !aiLoading && (aiQuestion.trim().length > 0 || attachedFile !== null);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <PageLayout hideFooter darkBg={false}>
      {/* Hidden file input — triggered by paperclip button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileAttach(f);
          e.target.value = ""; // allow re-selecting same file
        }}
      />

      <section className="bg-slate-50 px-0 py-0 md:px-6 md:py-6">
        <div className="mx-auto flex max-w-7xl gap-0 overflow-hidden rounded-none border border-gray-200 bg-white shadow-sm md:rounded-lg h-[calc(100vh_-_5.4rem)] md:h-[calc(100vh_-_8.4rem)]">

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
                onClick={fetchConversations}
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
                  key={conv.id}
                  onClick={() => editingConvId !== conv.id && loadConversation(conv.id)}
                  className={`group mx-1 flex cursor-pointer items-start justify-between gap-1 rounded-lg px-3 py-2 transition-colors ${
                    activeConversationId === conv.id
                      ? "border border-blue-200 bg-blue-50"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {editingConvId === conv.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => renameConversation(conv.id, editingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameConversation(conv.id, editingTitle);
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
                          setEditingConvId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        title="Double-click to rename"
                      >
                        {conv.title}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">{formatDay(conv.updated_at)}</p>
                  </div>
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

            {/* Messages — also the drag-and-drop target */}
            <div
              className={`flex-1 space-y-4 overflow-y-auto px-6 py-4 transition-colors ${
                isDragOver ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : ""
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => {
                // Only clear when leaving the container itself, not a child
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileAttach(file);
              }}
            >
              {chatMessages.length === 0 && !isDragOver && (
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

              {isDragOver && (
                <div className="flex h-full flex-col items-center justify-center text-center pointer-events-none">
                  <PaperclipIcon size={40} className="mb-3 text-blue-400" />
                  <p className="text-base font-medium text-blue-600">Drop image to attach</p>
                </div>
              )}

              {!isDragOver && chatMessages.map((msg) => (
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
                    {/* Image thumbnail in user bubble */}
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Attached image"
                        className="mb-2 max-h-48 max-w-xs rounded-lg object-contain"
                      />
                    )}
                    <MessageContent text={msg.content} isUser={msg.role === "user"} />
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
                    <div className="flex h-4 items-center gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-gray-100 px-4 py-3 md:px-6 md:py-4">

              {/* Attached image preview strip */}
              {attachedFile && (
                <div className="mb-2 flex items-center gap-2">
                  <div className="relative shrink-0">
                    <img
                      src={attachedFile.preview}
                      alt="Attachment preview"
                      className="h-14 w-14 rounded-lg border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-900"
                      aria-label="Remove attachment"
                    >
                      <XIcon size={8} />
                    </button>
                  </div>
                  <span className="truncate text-xs text-gray-500 max-w-[200px]">
                    {attachedFile.name}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-0 md:flex-row md:items-end md:gap-2">
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
                        if (canSend) handleAskQuestion();
                      }
                    }}
                    onPaste={(e) => {
                      // Support Ctrl+V image paste
                      const items = Array.from(e.clipboardData.items);
                      const imageItem = items.find((i) => i.type.startsWith("image/"));
                      if (imageItem) {
                        e.preventDefault();
                        const file = imageItem.getAsFile();
                        if (file) handleFileAttach(file);
                      }
                    }}
                    placeholder={attachedFile ? "Add a question about this image…" : "Ask a question…"}
                    rows={1}
                    disabled={aiLoading}
                    className="flex-1 resize-none overflow-hidden bg-transparent px-4 py-3 text-sm
                               leading-relaxed focus:outline-none
                               md:rounded-xl md:border md:border-gray-300 md:bg-white
                               md:focus:border-blue-500 md:focus:ring-2 md:focus:ring-blue-500"
                    style={{ maxHeight: "160px", overflowY: "auto" }}
                  />

                  {/* Mobile-only action row */}
                  <div className="flex items-center justify-between px-3 pb-2 md:hidden">
                    <div className="flex items-center gap-1">
                      {/* Paperclip — mobile */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={aiLoading}
                        title="Attach image"
                        className={`flex items-center justify-center rounded-full p-1.5 transition-colors disabled:opacity-40 ${
                          attachedFile
                            ? "bg-blue-100 text-blue-600"
                            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        }`}
                      >
                        <PaperclipIcon size={18} />
                      </button>
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
                    </div>
                    <button
                      type="button"
                      onClick={handleAskQuestion}
                      disabled={!canSend}
                      aria-label="Send message"
                      className={`flex items-center justify-center rounded-full p-2 text-white transition-colors
                                 disabled:cursor-not-allowed disabled:bg-gray-200 ${
                        useOrchestrator ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-900 hover:bg-gray-800"
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

                {/* Desktop: paperclip button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={aiLoading}
                  title="Attach image (or drag and drop)"
                  className={`hidden md:flex items-center justify-center rounded-xl p-3 transition-colors disabled:opacity-40 ${
                    attachedFile
                      ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                      : "border border-gray-300 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <PaperclipIcon size={18} />
                </button>

                {/* Desktop send button */}
                <button
                  type="button"
                  onClick={handleAskQuestion}
                  disabled={!canSend}
                  className={`hidden md:flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white transition-colors disabled:bg-gray-300 ${
                    useOrchestrator ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <SendIcon size={16} />
                  {aiLoading ? (useOrchestrator ? "Investigating…" : "Thinking…") : "Send"}
                </button>
              </div>

              {/* Footer row */}
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

// ── Inline icons ──────────────────────────────────────────────────────────────

type IconProps = { size?: number; className?: string };

function SendIcon({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function RefreshIcon({ size = 14, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" />
    </svg>
  );
}

function SparkleIcon({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M12.4 3.1a.75.75 0 0 1 1.2 0l1.9 2.8a.75.75 0 0 0 .5.3l3.2.8a.75.75 0 0 1 .3 1.3l-2.1 1.8a.75.75 0 0 0-.2.7l.5 3.1a.75.75 0 0 1-1.1.8l-3-1.5a.75.75 0 0 0-.7 0l-3 1.5a.75.75 0 0 1-1.1-.8l.5-3.1a.75.75 0 0 0-.2-.7L7 8.3A.75.75 0 0 1 7.3 7l3.2-.8a.75.75 0 0 0 .5-.3l1.4-2.8Z" />
      <path d="M5.2 12.2a.6.6 0 0 1 1 0l.7 1.2a.6.6 0 0 0 .3.3l1.2.7a.6.6 0 0 1 0 1l-1.2.7a.6.6 0 0 0-.3.3l-.7 1.2a.6.6 0 0 1-1 0l-.7-1.2a.6.6 0 0 0-.3-.3L3 15.4a.6.6 0 0 1 0-1l1.2-.7a.6.6 0 0 0 .3-.3l.7-1.2ZM18.6 2.5a.5.5 0 0 1 .8 0l.4.7a.5.5 0 0 0 .2.2l.7.4a.5.5 0 0 1 0 .8l-.7.4a.5.5 0 0 0-.2.2l-.4.7a.5.5 0 0 1-.8 0l-.4-.7a.5.5 0 0 0-.2-.2l-.7-.4a.5.5 0 0 1 0-.8l.7-.4a.5.5 0 0 0 .2-.2l.4-.7Z" />
    </svg>
  );
}

function ArrowUpIcon({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function PlusIcon({ size = 20, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ShieldAlertIcon({ size = 13, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function PaperclipIcon({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function XIcon({ size = 10, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

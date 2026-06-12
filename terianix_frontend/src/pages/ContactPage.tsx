import { useCallback, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const INQUIRY_TYPES = [
  "Product demo",
  "Potential engagement",
  "Partnership",
  "Press",
  "Other",
] as const;

type InquiryType = (typeof INQUIRY_TYPES)[number];
type Status = "idle" | "submitting" | "success" | "error";

const API_BASE    = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_FILES   = 3;
const MAX_BYTES   = 10 * 1024 * 1024; // 10 MB per file

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ContactPage() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [company, setCompany] = useState("");
  const [inquiry, setInquiry] = useState<InquiryType>("Product demo");
  const [message, setMessage] = useState("");
  const [status, setStatus]   = useState<Status>("idle");
  const [files, setFiles]     = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    setFileError("");
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} attachments allowed.`);
        break;
      }
      if (f.size > MAX_BYTES) {
        setFileError(`"${f.name}" is over the 10 MB limit.`);
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue; // dedupe
      next.push(f);
    }
    setFiles(next);
  }, [files]);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setFileError("");
  };

  const disabled = status === "submitting" || status === "success";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");

    const fd = new FormData();
    fd.append("name",    name);
    fd.append("email",   email);
    fd.append("company", company);
    fd.append("inquiry", inquiry);
    fd.append("message", message);
    for (const f of files) fd.append("files", f, f.name);

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        body:   fd,
        // No Content-Type header — browser sets it with the boundary automatically
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
      setFiles([]);
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "w-full rounded-md border border-white/20 bg-[#0f0d18] px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50";

  return (
    <PageLayout>
      <PageHero
        eyebrow="Contact"
        title="We would like to hear from you."
        description="Whether you're requesting a demo, exploring a partnership, or just have a question — we read every message and reply within one business day."
      />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="text-lg font-bold text-slate-100">Direct contacts</h2>
            <ContactLink label="Sales & demos" email="sales@terian-services.com" />
            <ContactLink label="Support"       email="support@terian-services.com" />
            <ContactLink label="Security"      email="security@terian-services.com" />

            <div className="mt-10 rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-violet-400 p-5 text-sm leading-7 text-slate-300">
              <p className="font-semibold text-slate-100">Where we are</p>
              <p className="mt-2">
                Hosted in Microsoft Azure, primary region{" "}
                <span className="font-semibold">West US 2</span>.
              </p>
              <p className="mt-2">
                Each customer gets a fully isolated tenant — your data never
                touches another customer's environment. Azure AD SSO and B2B
                guest access work from day one.
              </p>
            </div>
          </div>

          {/* ── Form ── */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-8"
          >
            <p className="text-sm font-semibold text-slate-100">Send us a message</p>
            <p className="mt-1 text-xs text-slate-400">
              We'll get back to you within one business day.
            </p>

            {/* Success banner */}
            {status === "success" && (
              <div className="mt-4 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm text-violet-300">
                Message sent — we'll be in touch shortly.
              </div>
            )}

            {/* Error banner */}
            {status === "error" && (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                Something went wrong. Please try again or email{" "}
                <a
                  href="mailto:support@terian-services.com"
                  className="font-semibold underline underline-offset-2"
                >
                  support@terian-services.com
                </a>{" "}
                directly.
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
              <Field label="Work email" required>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
              <Field label="Company">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
              <Field label="Inquiry type" required>
                <select
                  value={inquiry}
                  onChange={(e) => setInquiry(e.target.value as InquiryType)}
                  disabled={disabled}
                  className={inputClass}
                >
                  {INQUIRY_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-zinc-900">
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Message" required>
                <textarea
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
            </div>

            {/* ── Attachments ── */}
            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Attachments
                <span className="ml-2 font-normal normal-case text-slate-500">
                  (optional · up to {MAX_FILES} files · 10 MB each)
                </span>
              </span>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />

              {/* Drag-drop zone (shown when room for more files) */}
              {files.length < MAX_FILES && !disabled && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-5 text-center transition
                    ${isDragOver
                      ? "border-violet-400 bg-violet-500/10"
                      : "border-white/20 hover:border-violet-400/60 hover:bg-white/5"
                    }`}
                >
                  <PaperclipIcon className="h-5 w-5 text-slate-400" />
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-violet-400">Browse</span>
                    {" "}or drag files here
                  </p>
                </div>
              )}

              {/* Validation error */}
              {fileError && (
                <p className="mt-1.5 text-xs text-rose-400">{fileError}</p>
              )}

              {/* Attached file badges */}
              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0a0916] px-3 py-2">
                      <FileIcon className="h-4 w-4 shrink-0 text-violet-400" />
                      <span className="flex-1 truncate text-xs text-slate-200">{f.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatBytes(f.size)}</span>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="ml-1 shrink-0 text-slate-500 hover:text-rose-400 transition"
                          aria-label={`Remove ${f.name}`}
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={disabled}
                className="inline-flex items-center justify-center rounded-md bg-violet-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "submitting" ? "Sending…" : "Send message →"}
              </button>
              <span className="text-xs text-slate-400">
                Or email{" "}
                <a
                  className="font-semibold text-violet-400 hover:text-violet-300"
                  href="mailto:support@terian-services.com"
                >
                  support@terian-services.com
                </a>
              </span>
            </div>
          </form>
        </div>
        </div>
      </section>
    </PageLayout>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
        {label}
        {required ? <span className="ml-1 text-rose-400">*</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// ── Inline icons ─────────────────────────────────────────────────────────────

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function ContactLink({ label, email }: { label: string; email: string }) {
  return (
    <div className="mt-3 first:mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <a
        className="text-sm font-semibold text-violet-400 hover:text-violet-300"
        href={`mailto:${email}`}
      >
        {email}
      </a>
    </div>
  );
}

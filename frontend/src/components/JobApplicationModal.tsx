import { useCallback, useRef, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

type FieldErrors = {
  name?: string;
  email?: string;
  linkedin?: string;
  message?: string;
  resume?: string;
};

const API_BASE    = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_BYTES   = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE     = /^https?:\/\/.+/i;

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type Props = {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
};

export default function JobApplicationModal({ jobId, jobTitle, onClose }: Props) {
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [linkedin,   setLinkedin]   = useState("");
  const [message,    setMessage]    = useState("");
  const [resume,     setResume]     = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errors,     setErrors]     = useState<FieldErrors>({});
  const [status,     setStatus]     = useState<Status>("idle");
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!name.trim())                              e.name     = "Full name is required.";
    if (!email.trim())                             e.email    = "Email is required.";
    else if (!EMAIL_RE.test(email.trim()))         e.email    = "Please enter a valid email address.";
    if (linkedin.trim() && !URL_RE.test(linkedin.trim()))
                                                   e.linkedin = "Please enter a valid URL (starting with http:// or https://).";
    if (!message.trim())                           e.message  = "Cover note is required.";
    if (!resume)                                   e.resume   = "Please attach your resume.";
    return e;
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  // ── File handling ─────────────────────────────────────────────────────────

  const pickFile = useCallback((f: File) => {
    const next: FieldErrors = {};
    if (!ALLOWED_TYPES.has(f.type)) {
      next.resume = "Please upload a PDF or Word document (.pdf, .doc, .docx).";
      setErrors((prev) => ({ ...prev, ...next }));
      return;
    }
    if (f.size > MAX_BYTES) {
      next.resume = `"${f.name}" exceeds the 10 MB limit (${formatBytes(f.size)}).`;
      setErrors((prev) => ({ ...prev, ...next }));
      return;
    }
    setResume(f);
    setErrors((prev) => { const n = { ...prev }; delete n.resume; return n; });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, [pickFile]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setStatus("submitting");
    setSubmitError("");

    const fd = new FormData();
    fd.append("name",         name.trim());
    fd.append("email",        email.trim());
    fd.append("linkedin_url", linkedin.trim());
    fd.append("message",      message.trim());
    fd.append("resume",       resume!, resume!.name);

    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}/apply`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`);
      }
      setStatus("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("error");
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputBase = "w-full rounded-lg border bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 transition";
  const inputOk   = "border-slate-300 focus:border-teal-500 focus:ring-teal-500";
  const inputErr  = "border-red-500 focus:border-red-500 focus:ring-red-500";
  const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 mb-1.5";

  function fieldClass(field: keyof FieldErrors) {
    return `${inputBase} ${errors[field] ? inputErr : inputOk}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-black"
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
            <path d="M5 5 15 15M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>

        {status === "success" ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/15">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-teal-600" fill="none">
                <path d="M5 13 9 17 19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-playfair text-2xl font-bold text-black">Application submitted</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Thanks for your interest in the <span className="text-black font-semibold">{jobTitle}</span> role.
              We'll be in touch if there's a good fit.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-md bg-teal-400 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-playfair text-xl font-bold text-black">Apply</h2>
            <p className="mt-1 text-sm text-slate-600 leading-6">{jobTitle}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
              {/* Name */}
              <div>
                <label className={labelClass} htmlFor="ja-name">Full name *</label>
                <input
                  id="ja-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                  placeholder="Jane Smith"
                  className={fieldClass("name")}
                  aria-describedby={errors.name ? "ja-name-err" : undefined}
                />
                {errors.name && <FieldError id="ja-name-err">{errors.name}</FieldError>}
              </div>

              {/* Email */}
              <div>
                <label className={labelClass} htmlFor="ja-email">Email *</label>
                <input
                  id="ja-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                  placeholder="jane@example.com"
                  className={fieldClass("email")}
                  aria-describedby={errors.email ? "ja-email-err" : undefined}
                />
                {errors.email && <FieldError id="ja-email-err">{errors.email}</FieldError>}
              </div>

              {/* LinkedIn */}
              <div>
                <label className={labelClass} htmlFor="ja-linkedin">
                  LinkedIn URL <span className="normal-case font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ja-linkedin"
                  type="url"
                  value={linkedin}
                  onChange={(e) => { setLinkedin(e.target.value); clearFieldError("linkedin"); }}
                  placeholder="https://linkedin.com/in/janesmith"
                  className={fieldClass("linkedin")}
                  aria-describedby={errors.linkedin ? "ja-linkedin-err" : undefined}
                />
                {errors.linkedin && <FieldError id="ja-linkedin-err">{errors.linkedin}</FieldError>}
              </div>

              {/* Cover note */}
              <div>
                <label className={labelClass} htmlFor="ja-message">Cover note *</label>
                <textarea
                  id="ja-message"
                  rows={5}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); clearFieldError("message"); }}
                  placeholder="Tell us why you're a strong fit for this role..."
                  className={`${fieldClass("message")} resize-y min-h-[120px]`}
                  aria-describedby={errors.message ? "ja-message-err" : undefined}
                />
                {errors.message && <FieldError id="ja-message-err">{errors.message}</FieldError>}
              </div>

              {/* Resume */}
              <div>
                <label className={labelClass}>
                  Resume * <span className="normal-case font-normal text-slate-400">PDF or Word, max 10 MB</span>
                </label>

                {resume ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-teal-600" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate text-sm text-black">{resume.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatBytes(resume.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setResume(null); setErrors((prev) => { const n = { ...prev }; delete n.resume; return n; }); }}
                      className="ml-3 shrink-0 text-xs text-slate-500 hover:text-slate-700 transition"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
                      errors.resume
                        ? "border-red-500"
                        : isDragOver
                        ? "border-teal-500 bg-teal-500/5"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                  >
                    <svg viewBox="0 0 24 24" className="mb-2 h-8 w-8 text-slate-400" fill="none">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm text-slate-600">Drag & drop or <span className="text-teal-600">browse</span></p>
                    <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX — max 10 MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                    />
                  </div>
                )}

                {errors.resume && <FieldError>{errors.resume}</FieldError>}
              </div>

              {status === "error" && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError || "Something went wrong. Please try again."}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-md bg-teal-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === "submitting" ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600" role="alert">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM7.25 5.5a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0v-3Z" />
      </svg>
      {children}
    </p>
  );
}

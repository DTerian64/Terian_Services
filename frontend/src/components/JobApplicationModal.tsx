import { useCallback, useRef, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const API_BASE    = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_BYTES   = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [linkedin,    setLinkedin]    = useState("");
  const [message,     setMessage]     = useState("");
  const [resume,      setResume]      = useState<File | null>(null);
  const [fileError,   setFileError]   = useState("");
  const [isDragOver,  setIsDragOver]  = useState(false);
  const [status,      setStatus]      = useState<Status>("idle");
  const [errorMsg,    setErrorMsg]    = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = useCallback((f: File) => {
    setFileError("");
    if (!ALLOWED_TYPES.has(f.type)) {
      setFileError("Please upload a PDF or Word document (.pdf, .doc, .docx).");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError(`"${f.name}" exceeds the 10 MB limit (${formatBytes(f.size)}).`);
      return;
    }
    setResume(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, [pickFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume) { setFileError("Please attach your resume."); return; }
    setStatus("submitting");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("name",         name.trim());
    fd.append("email",        email.trim());
    fd.append("linkedin_url", linkedin.trim());
    fd.append("message",      message.trim());
    fd.append("resume",       resume, resume.name);

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
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("error");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 transition";
  const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0d18] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
            <path d="M5 5 15 15M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>

        {status === "success" ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/15">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-teal-400" fill="none">
                <path d="M5 13 9 17 19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-playfair text-2xl font-bold text-slate-100">Application submitted</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Thanks for your interest in the <span className="text-slate-200">{jobTitle}</span> role.
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
            <h2 className="font-playfair text-xl font-bold text-slate-100">Apply</h2>
            <p className="mt-1 text-sm text-slate-400 leading-6">{jobTitle}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
              {/* Name */}
              <div>
                <label className={labelClass} htmlFor="ja-name">Full name *</label>
                <input
                  id="ja-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className={inputClass}
                />
              </div>

              {/* Email */}
              <div>
                <label className={labelClass} htmlFor="ja-email">Email *</label>
                <input
                  id="ja-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className={inputClass}
                />
              </div>

              {/* LinkedIn */}
              <div>
                <label className={labelClass} htmlFor="ja-linkedin">LinkedIn URL <span className="normal-case font-normal text-slate-500">(optional)</span></label>
                <input
                  id="ja-linkedin"
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/janesmith"
                  className={inputClass}
                />
              </div>

              {/* Cover note */}
              <div>
                <label className={labelClass} htmlFor="ja-message">Cover note *</label>
                <textarea
                  id="ja-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us why you're a strong fit for this role..."
                  className={`${inputClass} resize-y min-h-[120px]`}
                />
              </div>

              {/* Resume upload */}
              <div>
                <label className={labelClass}>Resume * <span className="normal-case font-normal text-slate-500">PDF or Word, max 10 MB</span></label>

                {resume ? (
                  <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-teal-400" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate text-sm text-slate-200">{resume.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatBytes(resume.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setResume(null); setFileError(""); }}
                      className="ml-3 shrink-0 text-xs text-slate-500 hover:text-slate-300 transition"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
                      isDragOver ? "border-teal-400 bg-teal-400/5" : "border-white/15 hover:border-white/30"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                  >
                    <svg viewBox="0 0 24 24" className="mb-2 h-8 w-8 text-slate-500" fill="none">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm text-slate-400">Drag & drop or <span className="text-teal-400">browse</span></p>
                    <p className="mt-1 text-xs text-slate-600">PDF, DOC, DOCX — max 10 MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                    />
                  </div>
                )}

                {fileError && (
                  <p className="mt-2 text-xs text-red-400">{fileError}</p>
                )}
              </div>

              {status === "error" && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {errorMsg || "Something went wrong. Please try again."}
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

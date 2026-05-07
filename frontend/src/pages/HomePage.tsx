export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f3f4f6" }}>
      {/* Header */}
      <header
        className="text-white text-center py-16 px-6"
        style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
      >
        <div className="text-5xl mb-4">⚡</div>
        <h1 className="text-3xl font-bold tracking-tight">Terian Services</h1>
        <p className="mt-3 text-indigo-200 text-lg max-w-xl mx-auto">
          Enterprise SaaS solutions built for modern HR and people operations teams.
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">
        <div className="bg-white rounded-2xl shadow-md p-10 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Welcome to Terian Services
          </h2>
          <p className="text-gray-600 leading-relaxed mb-8">
            We build cloud-native platforms that simplify award nominations, recognition,
            and compensation workflows for enterprise organisations. Our products integrate
            natively with Microsoft Azure AD and HR systems like Workday.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 text-left">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <div className="text-2xl mb-2">🏆</div>
              <h3 className="font-semibold text-indigo-900 mb-1">Award Nominations</h3>
              <p className="text-indigo-700 text-sm">
                Streamlined peer recognition and manager-led award workflows with full
                audit trail.
              </p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-5">
              <div className="text-2xl mb-2">🔐</div>
              <h3 className="font-semibold text-violet-900 mb-1">Azure AD Native</h3>
              <p className="text-violet-700 text-sm">
                Single sign-on for every employee — no extra credentials, no IT overhead.
              </p>
            </div>
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-5">
              <div className="text-2xl mb-2">💸</div>
              <h3 className="font-semibold text-purple-900 mb-1">Workday Integration</h3>
              <p className="text-purple-700 text-sm">
                Approved awards flow automatically into Workday as compensation events.
              </p>
            </div>
          </div>

          <a
            href="mailto:support@terian-services.com"
            className="inline-block px-6 py-3 rounded-lg text-white font-medium text-sm"
            style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
          >
            Get in touch →
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200">
        &copy; {new Date().getFullYear()} Terian Services &nbsp;·&nbsp;
        <a href="/privacy" className="text-gray-500 hover:underline">
          Privacy Notice
        </a>
      </footer>
    </div>
  );
}

import Header from "./Header";
import Footer from "./Footer";

export default function PageLayout({
  children,
  hideFooter = false,
  darkBg = true,
}: {
  children: React.ReactNode;
  hideFooter?: boolean;
  darkBg?: boolean;
}) {
  return (
    <div
      className={`flex min-h-screen flex-col text-left ${
        darkBg ? "page-bg-dark text-slate-100" : "bg-slate-50 text-slate-950"
      }`}
    >
      <Header />
      <main className="flex-1">{children}</main>
      {hideFooter ? null : <Footer />}
    </div>
  );
}

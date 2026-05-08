import Header from "./Header";
import Footer from "./Footer";

export default function PageLayout({
  children,
  hideFooter = false,
}: {
  children: React.ReactNode;
  hideFooter?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <Header />
      <main className="flex-1">{children}</main>
      {hideFooter ? null : <Footer />}
    </div>
  );
}

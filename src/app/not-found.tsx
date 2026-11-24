import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5">
      <div className="hero-aura pointer-events-none absolute inset-0" />
      <div className="relative max-w-md text-center">
        <Link href="/" className="inline-block"><Logo /></Link>
        <p className="eyebrow mt-10">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-muted">It may have moved, or the link may be mistyped.</p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-signal-500 px-4 text-sm font-medium text-white">Back to home</Link>
          <Link href="/contact" className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm text-fg">Contact us</Link>
        </div>
      </div>
    </main>
  );
}

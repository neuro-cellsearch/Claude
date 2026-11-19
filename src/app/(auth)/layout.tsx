import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="hero-aura pointer-events-none absolute inset-0" />
      <div className="grid-backdrop pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/"><Logo /></Link>
        <Link href="/" className="text-[13px] text-muted hover:text-fg">← Back to site</Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-5 pb-16">{children}</main>
    </div>
  );
}

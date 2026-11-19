"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/case-studies", label: "Case studies" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink-950/75 backdrop-blur-xl no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" aria-label="Kairo Systems home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-2 text-[13.5px] transition-colors",
                path.startsWith(n.href) ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={buttonClass("ghost", "sm")}>Client login</Link>
          <Link href="/book" className={buttonClass("primary", "sm")}>Book a consultation</Link>
        </div>
        <button className="rounded-md p-2 text-muted lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-ink-950 px-5 pb-6 pt-2 lg:hidden" aria-label="Mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-line/60 py-3 text-[15px] text-fg/90">
              {n.label}
            </Link>
          ))}
          <div className="mt-5 grid gap-2">
            <Link href="/book" onClick={() => setOpen(false)} className={buttonClass("primary", "lg")}>Book a consultation</Link>
            <Link href="/login" onClick={() => setOpen(false)} className={buttonClass("secondary", "lg")}>Client login</Link>
          </div>
        </nav>
      )}
    </header>
  );
}

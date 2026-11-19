"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X, LogOut } from "lucide-react";
import {
  LayoutDashboard, ListChecks, Boxes, Activity, Users, CalendarDays, BarChart3, Building2, CreditCard, LifeBuoy, PlusSquare,
  Inbox, FileText, Workflow, PoundSterling, Target, Send, FileStack, Mails, Quote, Plug, Settings, type LucideIcon,
} from "lucide-react";

const ICONS = {
  LayoutDashboard, ListChecks, Boxes, Activity, Users, CalendarDays, BarChart3, Building2, CreditCard, LifeBuoy, PlusSquare,
  Inbox, FileText, Workflow, PoundSterling, Target, Send, FileStack, Mails, Quote, Plug, Settings,
} satisfies Record<string, LucideIcon>;
import { Logo } from "@/components/ui/logo";
import { cn } from "@/components/ui/cn";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };

export function DashboardShell({
  groups, children, userLabel, areaLabel, switchLink,
}: { groups: NavGroup[]; children: ReactNode; userLabel: string; areaLabel: string; switchLink?: { href: string; label: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = groups[0]?.items[0]?.href;

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="mb-1.5 px-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-subtle">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === root ? path === item.href : path.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition",
                      active ? "bg-signal-500/12 text-fg ring-1 ring-signal-500/25" : "text-muted hover:bg-ink-800 hover:text-fg",
                    )}
                  >
                    <Icon size={16} className={active ? "text-signal-300" : ""} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? <span className="rounded-full bg-signal-500 px-1.5 text-[10.5px] font-semibold text-white">{item.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-line p-3">
      {switchLink && <Link href={switchLink.href} className="mb-1 block rounded-lg px-3 py-2 text-[12.5px] text-signal-300 hover:bg-ink-800">{switchLink.label}</Link>}
      <p className="truncate px-3 text-[12px] text-subtle" title={userLabel}>{userLabel}</p>
      <form action="/auth/signout" method="post">
        <button className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted hover:bg-ink-800 hover:text-fg"><LogOut size={15} /> Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-ink-900 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5">
          <Link href="/"><Logo /></Link>
        </div>
        <p className="px-6 pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-signal-300">{areaLabel}</p>
        {nav}
        {footer}
      </aside>
      <div className="flex h-14 items-center justify-between border-b border-line bg-ink-900 px-4 lg:hidden">
        <Link href="/"><Logo /></Link>
        <button onClick={() => setOpen((o) => !o)} className="p-2 text-muted" aria-label="Toggle navigation">{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {open && <div className="flex flex-col border-b border-line bg-ink-900 lg:hidden">{nav}{footer}</div>}
      <main className="min-w-0 px-4 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}

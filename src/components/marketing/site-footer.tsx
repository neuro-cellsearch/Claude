import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { SERVICES } from "@/lib/content/services";
import { INDUSTRIES } from "@/lib/content/industries";
import { site } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink-950 no-print">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-muted">
            AI automation systems for UK businesses. Designed around your processes, tested before launch, and monitored every day.
          </p>
          <p className="mt-4 text-[13px] text-subtle">
            <a href={`mailto:${site.email}`} className="hover:text-fg">{site.email}</a>
            {site.phone && <> · <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-fg">{site.phone}</a></>}
          </p>
        </div>
        <FooterCol title="Services" links={SERVICES.map((s) => ({ href: `/services/${s.slug}`, label: s.name }))} />
        <FooterCol title="Industries" links={INDUSTRIES.slice(0, 6).map((i) => ({ href: `/industries/${i.slug}`, label: i.name }))} />
        <FooterCol
          title="Company"
          links={[
            { href: "/about", label: "About" },
            { href: "/pricing", label: "Pricing" },
            { href: "/case-studies", label: "Case studies" },
            { href: "/contact", label: "Contact" },
            { href: "/quote", label: "Request a quote" },
            { href: "/book", label: "Book a consultation" },
          ]}
        />
      </div>
      <div className="border-t border-line/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-[12px] text-subtle sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} {site.legalName}
            {site.companyNumber && <> · Registered in England &amp; Wales No. {site.companyNumber}</>}
            {site.address && <> · {site.address}</>}
            {site.icoRegistration && <> · ICO {site.icoRegistration}</>}
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            <Link href="/terms" className="hover:text-fg">Terms</Link>
            <Link href="/login" className="hover:text-fg">Client login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-wider text-subtle">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[13.5px] text-muted transition-colors hover:text-fg">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { DashboardShell, type NavGroup } from "@/components/dashboard/shell";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { Notice } from "@/components/ui/primitives";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  if (!hasServiceRole()) {
    return <div className="mx-auto max-w-xl p-10"><Notice tone="amber" title="Setup required">SUPABASE_SERVICE_ROLE_KEY is not set. The admin area needs it for server-side operations. See docs/DEPLOYMENT.md.</Notice></div>;
  }
  const db = createAdminClient();
  const [{ count: newEnq }, { count: openTickets }, { count: awaiting }] = await Promise.all([
    db.from("enquiries").select("id", { count: "exact", head: true }).eq("stage", "new"),
    db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    db.from("automations").select("id", { count: "exact", head: true }).eq("status", "awaiting_approval"),
  ]);
  const isAdmin = profile.role === "admin";
  const groups: NavGroup[] = [
    { items: [{ href: "/admin", label: "Overview", icon: "LayoutDashboard" }] },
    { title: "Sales", items: [
      { href: "/admin/enquiries", label: "Enquiries & pipeline", icon: "Inbox", badge: newEnq ?? 0 },
      { href: "/admin/consultations", label: "Consultations", icon: "CalendarDays" },
      { href: "/admin/quotes", label: "Quotes & proposals", icon: "FileText" },
    ] },
    { title: "Acquisition", items: [
      { href: "/admin/prospects", label: "Prospects", icon: "Target" },
      { href: "/admin/campaigns", label: "Outreach campaigns", icon: "Send" },
      { href: "/admin/templates", label: "Outreach templates", icon: "FileStack" },
      { href: "/admin/sequences", label: "Email sequences", icon: "Mails" },
    ] },
    { title: "Delivery", items: [
      { href: "/admin/customers", label: "Customers", icon: "Building2" },
      { href: "/admin/onboarding", label: "Onboarding", icon: "ListChecks" },
      { href: "/admin/automations", label: "Automations", icon: "Workflow", badge: awaiting ?? 0 },
      { href: "/admin/support", label: "Support", icon: "LifeBuoy", badge: openTickets ?? 0 },
    ] },
    { title: "Business", items: [
      { href: "/admin/billing", label: "Subscriptions & payments", icon: "CreditCard" },
      ...(isAdmin ? [{ href: "/admin/finance", label: "Finance & forecast", icon: "PoundSterling" as const }] : []),
      { href: "/admin/content", label: "Case studies & reviews", icon: "Quote" },
      ...(isAdmin ? [
        { href: "/admin/integrations", label: "Integrations", icon: "Plug" as const },
        { href: "/admin/settings", label: "Settings", icon: "Settings" as const },
      ] : []),
    ] },
  ];
  return (
    <DashboardShell groups={groups} areaLabel={isAdmin ? "Admin" : "Staff"} userLabel={profile.email} switchLink={{ href: "/portal", label: "→ View client portal" }}>
      {children}
    </DashboardShell>
  );
}

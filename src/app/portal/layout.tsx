import { DashboardShell, type NavGroup } from "@/components/dashboard/shell";
import { getPortalContext } from "./context";
import { isStaffRole } from "@/lib/auth";

export const metadata = { title: "Client portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, org, supabase } = await getPortalContext();
  const { count: openTickets } = await supabase.from("support_tickets").select("id", { count: "exact", head: true })
    .in("status", ["waiting_on_customer"]);
  const groups: NavGroup[] = [
    { items: [
      { href: "/portal", label: "Overview", icon: "LayoutDashboard" },
      { href: "/portal/onboarding", label: "Onboarding", icon: "ListChecks" },
    ] },
    { title: "Performance", items: [
      { href: "/portal/services", label: "My automations", icon: "Boxes" },
      { href: "/portal/activity", label: "Activity", icon: "Activity" },
      { href: "/portal/leads", label: "Leads", icon: "Users" },
      { href: "/portal/appointments", label: "Appointments", icon: "CalendarDays" },
      { href: "/portal/analytics", label: "Analytics", icon: "BarChart3" },
    ] },
    { title: "Account", items: [
      { href: "/portal/business", label: "Business details", icon: "Building2" },
      { href: "/portal/billing", label: "Billing", icon: "CreditCard" },
      { href: "/portal/support", label: "Support", icon: "LifeBuoy", badge: openTickets ?? 0 },
      { href: "/portal/requests", label: "Request automation", icon: "PlusSquare" },
    ] },
  ];
  return (
    <DashboardShell
      groups={groups}
      areaLabel={org?.name ?? "Client portal"}
      userLabel={profile.email}
      switchLink={isStaffRole(profile.role) ? { href: "/admin", label: "→ Admin dashboard" } : undefined}
    >
      {children}
    </DashboardShell>
  );
}

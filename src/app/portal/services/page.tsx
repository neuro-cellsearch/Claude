import { getPortalContext } from "../context";
import { PageHeader, Card, StatusBadge, EmptyState, Notice } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { SERVICE_BY_KEY } from "@/lib/content/services";
import { date } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const STAGES = ["requested", "in_build", "testing", "awaiting_approval", "active"] as const;
const STAGE_LABEL: Record<string, string> = { requested: "Requested", in_build: "Building", testing: "Testing", awaiting_approval: "Approval", active: "Live" };

export default async function ServicesPage() {
  const { supabase } = await getPortalContext();
  const { data: automations } = await supabase.from("automations").select("*").order("created_at");
  return (
    <>
      <PageHeader title="My automations" description="Every automation moves through build, testing and approval before it goes live." actions={<ButtonLink href="/portal/requests" variant="secondary">Request another</ButtonLink>} />
      {!automations?.length ? (
        <EmptyState title="No automations yet" description="Choose your automations during onboarding." action={<ButtonLink href="/portal/onboarding">Go to onboarding</ButtonLink>} />
      ) : (
        <div className="grid gap-4">
          {automations.map((a) => {
            const idx = STAGES.indexOf(a.status as (typeof STAGES)[number]);
            return (
              <Card key={a.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-fg">{a.name}</p>
                    <p className="mt-1 text-[13px] text-muted">{SERVICE_BY_KEY[a.service_key]?.short ?? a.description}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {idx >= 0 && (
                  <ol className="mt-5 grid grid-cols-5 gap-1.5">
                    {STAGES.map((s, i) => (
                      <li key={s}>
                        <div className={cn("h-1.5 rounded-full", i <= idx ? "bg-gradient-to-r from-signal-500 to-aura-500" : "bg-ink-700")} />
                        <p className={cn("mt-1.5 text-[11px]", i <= idx ? "text-fg/80" : "text-subtle")}>{STAGE_LABEL[s]}</p>
                      </li>
                    ))}
                  </ol>
                )}
                {["paused", "failed"].includes(a.status) && <div className="mt-4"><Notice tone={a.status === "failed" ? "red" : "amber"}>This automation is currently {a.status}. Our team has been alerted.</Notice></div>}
                <p className="mt-4 text-[12px] text-subtle">
                  {a.last_tested_at && `Last tested ${date(a.last_tested_at)} · `}{a.activated_at ? `Live since ${date(a.activated_at)}` : `Added ${date(a.created_at)}`}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

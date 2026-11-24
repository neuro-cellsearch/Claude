import { requireAdmin } from "@/lib/auth";
import { INTEGRATIONS, integrationStatus } from "@/lib/integrations/registry";
import { PageHeader, Card, StatusBadge, Badge, Notice } from "@/components/ui/primitives";
import { ActionForm } from "@/components/forms/action-form";
import { testIntegration } from "../_actions/admin";
import { serverEnv, site } from "@/lib/env";
import { checkEnv } from "@/lib/env-check";

export default async function IntegrationsPage() {
  await requireAdmin();
  const issues = checkEnv();
  return (
    <>
      <PageHeader title="Integrations" description="Status reflects whether credentials are set. 'Run live test' makes a real authenticated API call — an integration is only working once that passes." />
      {issues.length > 0 && (
        <div className="mb-4">
          <Notice tone={issues.some((i) => i.level === "error") ? "red" : "amber"} title={`Configuration check: ${issues.length} issue(s)`}>
            <ul className="mt-1 space-y-0.5">{issues.map((i) => <li key={i.variable + i.message}><code className="text-[12px]">{i.variable}</code> — {i.message}</li>)}</ul>
          </Notice>
        </div>
      )}
      <Notice title="Secrets stay on the server">Credentials are read from environment variables in your hosting provider and are never sent to the browser. To change one, update it in your hosting dashboard and redeploy.</Notice>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {INTEGRATIONS.map((i) => {
          const status = integrationStatus(i);
          return (
            <Card key={i.id}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-fg">{i.name}</p><p className="mt-1 text-[13px] text-muted">{i.purpose}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={status === "configured" ? "configured" : status === "partial" ? "partial" : "not_configured"} /><Badge>{i.category}</Badge></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {i.envVars.map((v) => <code key={v} className={`rounded px-1.5 py-0.5 text-[11px] ${serverEnv(v) ? "bg-success/10 text-success" : "bg-ink-700 text-muted"}`}>{v}{serverEnv(v) ? " ✓" : ""}</code>)}
                {(i.optionalEnvVars ?? []).map((v) => <code key={v} className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-subtle">{v} (optional){serverEnv(v) ? " ✓" : ""}</code>)}
              </div>
              <details className="mt-3"><summary className="cursor-pointer text-[13px] text-signal-300">Setup instructions</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12.5px] text-muted">{i.setup.map((s) => <li key={s}>{s.replace("https://YOUR-DOMAIN", site.url)}</li>)}</ol>
                <p className="mt-2 text-[12px] text-subtle">Cost: {i.costNote} · <a className="underline" href={i.docsUrl} target="_blank" rel="noreferrer">Docs</a></p>
              </details>
              {status !== "missing" && <ActionForm action={testIntegration} submitLabel="Run live test" size="sm" variant="secondary" pendingText="Testing…" className="mt-4"><input type="hidden" name="id" value={i.id} /></ActionForm>}
            </Card>
          );
        })}
      </div>
    </>
  );
}

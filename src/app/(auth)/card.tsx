import type { ReactNode } from "react";
import { hasSupabase } from "@/lib/env";
import { Notice } from "@/components/ui/primitives";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-md">
      <div className="surface-raised p-7 sm:p-8">
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13.5px] text-muted">{subtitle}</p>}
        {!hasSupabase() && (
          <div className="mt-5"><Notice tone="amber" title="Setup required">Supabase isn't configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — see docs/DEPLOYMENT.md.</Notice></div>
        )}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-[13.5px] text-muted">{footer}</div>}
    </div>
  );
}

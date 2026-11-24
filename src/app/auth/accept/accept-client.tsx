"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/redirect";

/**
 * Admin-initiated links (invites) return the session in the URL fragment, which
 * never reaches the server. Read it here, store it as cookies, then continue.
 */
export function AcceptClient({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function accept() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      // Remove tokens from the address bar and history immediately.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (params.get("error")) return setError(params.get("error_description") || "This link is invalid or has expired.");
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return setError("This link is missing its sign-in details. Please request a new one.");
      const { error: e } = await createClient().auth.setSession({ access_token, refresh_token });
      if (e) setError("This link is invalid or has expired. Please request a new one.");
      else window.location.replace(safeRedirectPath(next, "/portal"));
    }
    void accept();
  }, [next]);

  return (
    <div className="w-full max-w-md text-center">
      <div className="surface-raised p-8">
        {error ? (
          <>
            <p className="text-lg font-semibold text-fg">We couldn&apos;t sign you in</p>
            <p className="mt-2 text-[14px] text-muted">{error}</p>
            <Link href="/forgot-password" className="mt-5 inline-block text-signal-300 underline">Request a new link</Link>
          </>
        ) : (
          <p className="text-[14px] text-muted">Signing you in…</p>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing/section";
import { unsubscribeToken, safeEqual } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { email as emailSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const sp = await props.searchParams;
  const e = typeof sp.e === "string" ? sp.e : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const parsed = emailSchema.safeParse(e);
  let outcome: "ok" | "invalid" | "error" = "invalid";

  if (parsed.success && t && safeEqual(t, unsubscribeToken(parsed.data)) && hasServiceRole()) {
    const db = createAdminClient();
    const { error } = await db.from("suppression_list").upsert(
      { value: parsed.data, kind: "email", reason: "Unsubscribed via email link" },
      { onConflict: "value", ignoreDuplicates: true },
    );
    if (!error) {
      outcome = "ok";
      // Stop any active sequences and mark matching prospects as do-not-contact.
      const { data: enquiries } = await db.from("enquiries").select("id").ilike("email", parsed.data);
      const ids = (enquiries ?? []).map((x) => x.id);
      if (ids.length) await db.from("sequence_enrollments").update({ status: "stopped" }).in("enquiry_id", ids);
      await db.from("prospects").update({ status: "do_not_contact" }).ilike("business_email", parsed.data);
      await db.from("profiles").update({ marketing_consent: false }).ilike("email", parsed.data);
    } else outcome = "error";
  }

  return (
    <>
      <PageHero
        eyebrow="Email preferences"
        title={outcome === "ok" ? "You've been unsubscribed." : outcome === "error" ? "Something went wrong." : "This link isn't valid."}
        intro={
          outcome === "ok"
            ? "We won't send you marketing or follow-up emails again. You may still receive essential messages about services you've purchased."
            : "Please reply to any of our emails with \"unsubscribe\" and we'll remove you manually within 48 hours."
        }
      />
      <Section className="py-10"><span /></Section>
    </>
  );
}

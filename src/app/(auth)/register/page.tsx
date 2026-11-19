import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "../card";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage(props: PageProps<"/register">) {
  const sp = await props.searchParams;
  const plan = typeof sp.plan === "string" && ["starter", "growth", "premium"].includes(sp.plan) ? sp.plan : undefined;
  return (
    <AuthCard
      title="Create your client account"
      subtitle={plan ? `You've chosen the ${plan[0].toUpperCase() + plan.slice(1)} plan. Create an account to continue to secure checkout.` : "Set up your account to start onboarding."}
      footer={<>Already have an account? <Link href="/login" className="text-signal-300 hover:underline">Sign in</Link></>}
    >
      <RegisterForm plan={plan} />
    </AuthCard>
  );
}

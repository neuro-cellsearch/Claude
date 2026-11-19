import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "../card";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  return (
    <AuthCard title="Sign in" subtitle="Access your Kairo client portal." footer={<>New to Kairo? <Link href="/register" className="text-signal-300 hover:underline">Create an account</Link></>}>
      {sp.error === "link" && <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[13px] text-warning">That link has expired or was already used. Please sign in or request a new one.</p>}
      <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} />
    </AuthCard>
  );
}

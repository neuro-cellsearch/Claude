import Link from "next/link";
import { AuthCard } from "../card";
import { ForgotForm } from "../forms";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure link." footer={<Link href="/login" className="text-signal-300 hover:underline">Back to sign in</Link>}>
      <ForgotForm />
    </AuthCard>
  );
}

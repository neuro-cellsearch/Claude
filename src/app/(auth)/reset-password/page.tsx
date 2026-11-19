import { AuthCard } from "../card";
import { ResetForm } from "../forms";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPage() {
  return (
    <AuthCard title="Choose a new password">
      <ResetForm />
    </AuthCard>
  );
}

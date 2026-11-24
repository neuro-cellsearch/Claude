import { AcceptClient } from "./accept-client";
import { safeRedirectPath } from "@/lib/redirect";

export const metadata = { title: "Signing in", robots: { index: false } };

export default async function AcceptPage(props: PageProps<"/auth/accept">) {
  const sp = await props.searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <AcceptClient next={safeRedirectPath(sp.next, "/portal")} />
    </main>
  );
}

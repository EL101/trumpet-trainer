import { AppShell } from "@/components/layout";
import SignOut from "../components/SignOut";

export default function Progress() {
  return (
    <AppShell display="flex" flexDirection="column" gap="lg">
      <SignOut />
    </AppShell>
  );
}

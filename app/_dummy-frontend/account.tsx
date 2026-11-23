import { readSession } from "@/lib/auth/server";
import AccountForm from "./account-form";

export default async function AccountPage() {
  const session = await readSession();
  return <AccountForm signedInEmail={session?.user.email} />;
}

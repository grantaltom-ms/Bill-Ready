import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import type { Contractor, SessionUser } from "@/lib/types";

/** Signed-in user + their business, or redirect to the right place. */
export async function requireContractor(): Promise<{ user: SessionUser; contractor: Contractor }> {
  const store = getStore();
  const user = await store.currentUser();
  if (!user) redirect("/login");
  const contractor = await store.contractorForUser(user.id);
  if (!contractor) redirect("/onboarding");
  return { user, contractor };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getStore().currentUser();
  if (!user) redirect("/login");
  return user;
}

import type { Store } from "./store";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";

export const isTestMode = process.env.BILLREADY_TEST_MODE === "1";

export function getStore(): Store {
  return isTestMode ? memoryStore : supabaseStore;
}

export type { Store } from "./store";

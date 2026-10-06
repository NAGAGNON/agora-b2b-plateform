import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

config({ path: ".env.local" });

export const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
export type DB = SupabaseClient<Database>;

export const admin: DB = createClient<Database>(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
export const anon = (): DB => createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const created: string[] = [];
export const RUN = randomUUID().slice(0, 8);

/** Crée un utilisateur de test et renvoie un client authentifié. */
export async function user(label: string, role: Database["public"]["Enums"]["platform_role"] = "USER") {
  const email = `it-${RUN}-${label}@test.linkprob2b.test`;
  const password = `Test-${randomUUID()}-Aa1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `IT ${label}` } });
  if (error || !data.user) throw error;
  created.push(data.user.id);
  if (role !== "USER") await admin.from("users").update({ platform_role: role }).eq("id", data.user.id);
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, client };
}

export async function company(c: DB, name: string, kind: "SUPPLIER" | "BUYER" | "BOTH" = "BOTH") {
  const { data, error } = await c.rpc("create_company", {
    p_name: `IT ${RUN} ${name}`,
    p_kind: kind,
    p_city: "Brest",
    p_sectors: ["maintenance-industrielle"],
    p_skills: ["hydraulique"],
  });
  if (error) throw error;
  return data as string;
}

export async function cleanup() {
  await admin.from("opportunities").delete().like("title", `IT ${RUN}%`);
  await admin.from("companies").delete().like("name", `IT ${RUN}%`);
  await admin.from("external_sources").delete().like("name", `IT ${RUN}%`);
  for (const id of created) await admin.auth.admin.deleteUser(id);
}

export const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

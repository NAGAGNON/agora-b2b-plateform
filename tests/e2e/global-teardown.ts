import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

/** Supprime les comptes et entreprises créés par les tests E2E. */
export default async function globalTeardown() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key, { auth: { persistSession: false } });
  await db.from("companies").delete().like("name", "E2E %");
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email?.startsWith("e2e-") && u.email.endsWith("@test.linkprob2b.test")) await db.auth.admin.deleteUser(u.id);
}

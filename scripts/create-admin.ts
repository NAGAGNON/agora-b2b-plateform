/**
 * Crée (ou promeut) le compte SUPER_ADMIN de la plateforme.
 *
 *   npm run create-admin -- prenom.nom@entreprise.fr "Prénom Nom"
 *
 * Si le compte n'existe pas, il est créé avec un mot de passe aléatoire affiché
 * une seule fois : changez-le dès la première connexion (Paramètres) et activez
 * la double authentification.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const [email, fullName = "Administrateur"] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage : npm run create-admin -- adresse@exemple.fr "Prénom Nom"');
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SECRET_KEY sont requis.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let userId: string | undefined;
  let password: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    userId = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!data || data.users.length < 200) break;
  }
  if (!userId) {
    password = `${randomBytes(12).toString("base64url")}-Aa1`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, terms_accepted: "true" } });
    if (error || !data.user) throw error ?? new Error("Création impossible");
    userId = data.user.id;
  }
  const { error } = await db.from("users").update({ platform_role: "SUPER_ADMIN", full_name: fullName }).eq("id", userId);
  if (error) throw error;
  console.log(`Compte SUPER_ADMIN prêt : ${email}`);
  if (password) console.log(`Mot de passe initial (à changer immédiatement) : ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

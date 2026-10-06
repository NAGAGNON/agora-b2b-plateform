import { execSync } from "node:child_process";

/** Recharge les données de démonstration avec un mot de passe connu pour les comptes de test. */
export default function globalSetup() {
  process.env.DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-E2E-Passw0rd";
  execSync("npx tsx scripts/seed-demo.ts", { stdio: "inherit", env: process.env });
}

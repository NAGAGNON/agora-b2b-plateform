"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api("/auth/login", { body: { password } }); router.replace("/"); router.refresh(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="anim-in w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-accent font-bold text-accentfg">R</span>
          <div><h1 className="font-semibold">Reseller AI OS</h1><p className="text-xs text-muted">Accès propriétaire</p></div>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Mot de passe"><Input type="password" autoFocus autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" loading={busy} className="w-full">Se connecter</Button>
      </form>
    </main>
  );
}

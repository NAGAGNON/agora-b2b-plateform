import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadActivationFunnel, loadSignups, type ActivationFunnel, type SignupDetail } from "@/lib/admin-signups";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/demo";
import { COMPANY_KIND_LABELS, COMPANY_SIZE_LABELS } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";

export const metadata = { title: "Inscriptions" };
const PER = 20;

const EVENT_LABELS: Record<string, string> = {
  create_account: "Compte créé",
  profile_completed: "Profil d'entreprise complété",
  create_alert: "Alerte créée",
  save_favorite: "Favori ajouté",
  contact_company: "Entreprise contactée",
  source_outbound_clicked: "Lien vers la source officielle ouvert",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-navy">{children || "—"}</dd>
    </div>
  );
}

function SignupCard({ s }: { s: SignupDetail }) {
  const c = s.company;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4" data-testid="signup">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-navy">
          {s.fullName || "—"} {s.isDemo && <DemoBadge />}
        </h2>
        <p className="text-sm text-slate-600">
          Inscrit le <strong>{formatDateTime(s.createdAt)}</strong> ({relativeTime(s.createdAt)})
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section aria-label="Qui">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Qui</h3>
          <dl className="space-y-1.5">
            <Field label="E-mail">{s.email}</Field>
            <Field label="Fonction">{s.jobTitle}</Field>
            <Field label="Téléphone">{s.phone}</Field>
          </dl>
        </section>
        <section aria-label="Comment">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Comment</h3>
          <dl className="space-y-1.5">
            <Field label="Arrivé par">
              {s.origin.kind === "outreach" ? (
                <>
                  E-mail de prospection{s.origin.campaignDate ? ` du ${s.origin.campaignDate.split("-").reverse().join("/")}` : ""}
                  {s.origin.prospectName ? ` (envoyé à ${s.origin.prospectName})` : ""}
                  {s.origin.offerTitle ? <span className="block text-xs text-slate-500">Offre : {s.origin.offerTitle}</span> : null}
                </>
              ) : (
                "Directement sur le site"
              )}
            </Field>
            <Field label="Adresse e-mail confirmée">{s.emailConfirmedAt ? `Oui, le ${formatDateTime(s.emailConfirmedAt)}` : s.emailConfirmedAt === null ? "Non, pas encore" : "Inconnu"}</Field>
            <Field label="Consentements">
              {[s.termsAcceptedAt ? "Conditions acceptées" : "Conditions non acceptées", s.marketingConsent ? "accepte les nouveautés" : "refuse les nouveautés", s.notifyEmail ? "notifications par e-mail" : "sans notifications"].join(" · ")}
            </Field>
          </dl>
        </section>
        <section aria-label="Entreprise renseignée">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Ce qu&apos;il a rempli</h3>
          {c ? (
            <dl className="space-y-1.5">
              <Field label="Entreprise">{c.name}</Field>
              <Field label="SIREN">{c.siren}</Field>
              <Field label="Type / taille">{[COMPANY_KIND_LABELS[c.kind as keyof typeof COMPANY_KIND_LABELS] ?? c.kind, c.size ? (COMPANY_SIZE_LABELS[c.size as keyof typeof COMPANY_SIZE_LABELS] ?? c.size) : null].filter(Boolean).join(" · ")}</Field>
              <Field label="Lieu">{[c.postalCode, c.city, c.region].filter(Boolean).join(" ")}</Field>
              <Field label="Site web">{c.website}</Field>
              <Field label="Secteurs">{c.sectors.join(", ")}</Field>
            </dl>
          ) : (
            <p className="text-sm text-amber-700">Pas encore d&apos;entreprise renseignée (inscription non terminée).</p>
          )}
        </section>
        <section aria-label="Ensuite">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Ce qui s&apos;est passé ensuite</h3>
          <dl className="space-y-1.5">
            <Field label="Dernière visite">{s.lastSeenAt ? relativeTime(s.lastSeenAt) : "Jamais revenu"}</Field>
            <Field label="Activité">
              {`${s.activity.alerts} alerte(s) · ${s.activity.interests} intérêt(s) · ${s.activity.proposals} proposition(s) · ${s.activity.favorites} favori(s) · ${s.activity.savedSearches} recherche(s) enregistrée(s)`}
            </Field>
            <Field label="Abonnement">{s.activity.subscription ?? "Gratuit"}</Field>
          </dl>
          {s.activity.events.length > 0 && (
            <ol className="mt-2 space-y-0.5 border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
              {s.activity.events.map((e, i) => (
                <li key={i}>
                  {formatDateTime(e.at)} — {EVENT_LABELS[e.name] ?? e.name}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </li>
  );
}

function Funnel({ f }: { f: ActivationFunnel }) {
  const pct = (n: number, d: number) => (d ? ` (${Math.round((n / d) * 100)} %)` : "");
  const rows: [string, number, number][] = [
    ["Comptes créés", f.signups, f.signups],
    ["Entreprise créée", f.company, f.signups],
    ["Profil complété", f.profile, f.signups],
    ["Alerte créée", f.alert, f.signups],
    ["Veille par e-mail active", f.veille, f.signups],
    ["Opportunité en favori", f.favorite, f.signups],
  ];
  return (
    <section aria-labelledby="activation" className="mb-6 rounded-xl border border-slate-200 bg-white p-4" data-testid="activation-funnel">
      <h2 id="activation" className="mb-3 text-lg font-bold text-navy">
        Activation et retours
      </h2>
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(([label, n, d]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-xl font-bold text-navy">
              {n}
              <span className="text-sm font-medium text-slate-500">{label === "Comptes créés" ? "" : pct(n, d)}</span>
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-slate-500">Revenus après le jour d&apos;inscription</dt>
          <dd className="text-xl font-bold text-navy">
            {f.returned}
            <span className="text-sm font-medium text-slate-500">{` / ${f.eligible7}${pct(f.returned, f.eligible7)}`}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Encore actifs 7 jours après</dt>
          <dd className="text-xl font-bold text-navy">
            {f.returned7}
            <span className="text-sm font-medium text-slate-500">{` / ${f.eligible7}${pct(f.returned7, f.eligible7)}`}</span>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">Comptes réels uniquement. Retours calculés sur les comptes créés il y a plus de 7 jours, d&apos;après leur dernière visite enregistrée.</p>
    </section>
  );
}

export default async function AdminSignups(props: PageProps<"/admin/inscriptions">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const includeDemo = sp.demo === "1";
  const db = createAdminClient();
  const [{ rows, count }, funnel] = await Promise.all([loadSignups(db, { page, per: PER, includeDemo }), loadActivationFunnel(db)]);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Inscriptions</h1>
      <p className="mb-4 text-sm text-slate-600">
        {count} inscrit(s){includeDemo ? " (comptes de démonstration compris)" : ""}. Heures de Paris, du plus récent au plus ancien.
      </p>
      <Funnel f={funnel} />
      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((s) => (
            <SignupCard key={s.id} s={s} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Aucune inscription pour le moment" />
      )}
      <Pagination page={page} pageCount={Math.ceil(count / PER)} basePath="/admin/inscriptions" params={sp} />
    </div>
  );
}

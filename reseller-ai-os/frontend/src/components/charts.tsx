"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { eur, monthShort, pct } from "@/lib/format";

// Palette sobre (vert d'accent + neutres) — valable en clair et en sombre via des variables CSS
export const C = { accent: "var(--accent)", muted: "var(--muted)", line: "var(--line)", danger: "var(--danger)", info: "var(--info)", warn: "var(--warn)" };
const PIE = ["var(--accent)", "var(--info)", "var(--warn)", "var(--danger)", "#8b5cf6", "#0891b2", "#64748b"];

type Pt = { month: string; [k: string]: number | string | null };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--text)" }, labelStyle: { color: "var(--muted)" } };
const axis = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

export function Box({ title, sub, children, empty }: { title: string; sub?: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3"><h3 className="text-sm font-semibold">{title}</h3>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
      <div className="h-56">{empty ? <div className="grid h-full place-items-center text-sm text-muted">Pas encore de données</div> : children}</div>
    </div>
  );
}
const hasData = (d: Pt[], keys: string[]) => d.some((p) => keys.some((k) => Number(p[k] ?? 0) !== 0));

export function AreaSeries({ data, k, title, sub, color = C.accent }: { data: Pt[]; k: string; title: string; sub?: string; color?: string }) {
  const id = `g-${k}`;
  return (
    <Box title={title} sub={sub} empty={!hasData(data, [k])}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -10, right: 8, top: 5 }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthShort} {...axis} />
          <YAxis {...axis} tickFormatter={(v) => `${v}€`} width={50} />
          <Tooltip {...tip} formatter={(v) => eur(Number(v))} labelFormatter={(l) => String(l)} />
          <Area type="monotone" dataKey={k} stroke={color} strokeWidth={2} fill={`url(#${id})`} name={title} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function CompareBars({ data }: { data: Pt[] }) {
  return (
    <Box title="Achats vs ventes" sub="Achats de stock décaissés / chiffre d'affaires" empty={!hasData(data, ["purchases", "revenue"])}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -10, right: 8, top: 5 }}>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthShort} {...axis} />
          <YAxis {...axis} tickFormatter={(v) => `${v}€`} width={50} />
          <Tooltip {...tip} formatter={(v) => eur(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="purchases" name="Achats" fill={C.info} radius={[4, 4, 0, 0]} />
          <Bar dataKey="revenue" name="Ventes" fill={C.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function MarginLine({ data }: { data: Pt[] }) {
  return (
    <Box title="Marge moyenne" sub="Bénéfice des ventes / chiffre d'affaires" empty={!data.some((p) => p.avg_margin_pct !== null)}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -10, right: 8, top: 5 }}>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthShort} {...axis} />
          <YAxis {...axis} tickFormatter={(v) => `${v}%`} width={45} />
          <Tooltip {...tip} formatter={(v) => pct(Number(v))} />
          <Line type="monotone" dataKey="avg_margin_pct" name="Marge" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function CategoryPie({ data }: { data: { category: string; revenue: number }[] }) {
  return (
    <Box title="Ventes par catégorie" sub="12 derniers mois" empty={data.length === 0}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey="category" innerRadius={45} outerRadius={80} paddingAngle={data.length > 1 ? 2 : 0}>
            {data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} stroke="var(--surface)" />)}
          </Pie>
          <Tooltip {...tip} formatter={(v) => eur(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}
export type { Pt };

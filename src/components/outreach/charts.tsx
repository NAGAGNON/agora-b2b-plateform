"use client";

import { useState } from "react";

/**
 * Graphiques du tableau de bord Outreach — une seule série par graphique
 * (jamais de double axe), teinte unique teal-600 (#0D9488, contraste ≥ 3:1
 * sur blanc), barres fines aux extrémités arrondies, espacement de 2 px,
 * info-bulle au survol et au clavier, et tableau équivalent pour les lecteurs
 * d'écran.
 */

const BAR = "#0D9488";
const BAR_HOVER = "#0F766E";

export type Point = { label: string; value: number; hint?: string };

export function BarChart({ data, title, unit, height = 180 }: { data: Point[]; title: string; unit: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const W = 640;
  const padL = 34;
  const padB = 22;
  const innerW = W - padL - 4;
  const innerH = height - padB - 8;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(22, slot - 2));
  const a = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((t) => {
          const y = 8 + innerH - (t / top) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="#E2E8F0" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#64748B">
                {t.toLocaleString("fr-FR")}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / top) * innerH;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = 8 + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.label}>
              {h > 0 && (
                <path
                  d={`M${x},${8 + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${8 + innerH} Z`}
                  fill={active === i ? BAR_HOVER : BAR}
                />
              )}
              {/* Zone de survol plus large que la barre */}
              <rect
                x={padL + i * slot}
                y={8}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label} : ${d.value.toLocaleString("fr-FR")} ${unit}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none focus-visible:stroke-navy"
              />
              {(i % 7 === 0 || (i === data.length - 1 && i % 7 >= 4)) && (
                <text x={padL + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="#64748B">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={8 + innerH} y2={8 + innerH} stroke="#94A3B8" strokeWidth={1} />
      </svg>
      {a && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((padL + active * slot + slot / 2) / W) * 100}%` }}
        >
          <p className="text-base font-bold text-navy tabular-nums">{a.value.toLocaleString("fr-FR")}</p>
          <p className="text-slate-500">
            {unit} · {a.hint ?? a.label}
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Jour</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.hint ?? d.label}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function niceTicks(max: number): number[] {
  const step0 = max / 4;
  const mag = 10 ** Math.floor(Math.log10(step0 || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const n = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * step));
}

/** Entonnoir de conversion : barres horizontales, valeur et taux affichés directement. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1, ...steps.map((s) => s.value));
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? `${((s.value / prev) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % de l'étape précédente` : null;
        return (
          <li key={s.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
            <span className="truncate text-slate-600">{s.label}</span>
            <span className="flex items-center gap-2" title={rate ?? undefined}>
              <span className="h-5 rounded-r" style={{ width: `${Math.max(s.value > 0 ? 2 : 0, (s.value / max) * 100)}%`, background: BAR, borderRadius: "0 4px 4px 0" }} aria-hidden />
              <span className="font-semibold text-navy tabular-nums">{s.value.toLocaleString("fr-FR")}</span>
              {rate && <span className="hidden text-xs text-slate-500 md:inline">· {rate.replace(" de l'étape précédente", "")}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

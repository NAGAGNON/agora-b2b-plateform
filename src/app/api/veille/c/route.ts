import { NextResponse } from "next/server";
import { isUuid } from "@/lib/format";
import { siteUrl } from "@/lib/seo";
import { recordVeilleEvent } from "@/lib/veille/tracking";

const PAGES: Record<string, string> = {
  opportunites: "/opportunites",
  preferences: "/dashboard/veille",
  quotidien: "/dashboard/veille?frequence=quotidienne",
};

/** Lien d'un e-mail de veille : clic enregistré puis redirection vers la page annoncée (toujours sur le site). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const opp = sp.get("o");
  const target = opp && isUuid(opp) ? `/opportunites/${opp}` : (PAGES[sp.get("p") ?? ""] ?? "/opportunites");
  await recordVeilleEvent(sp.get("t"), "CLICK", opp && isUuid(opp) ? opp : undefined);
  const url = new URL(target, siteUrl());
  url.searchParams.set("utm_source", "veille");
  url.searchParams.set("utm_medium", "email");
  return NextResponse.redirect(url, 302);
}

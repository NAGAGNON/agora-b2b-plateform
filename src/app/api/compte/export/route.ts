import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Export RGPD des données personnelles de l'utilisateur connecté. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Authentification requise", { status: 401 });
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return new NextResponse("Export impossible", { status: 500 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="linkprob2b-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

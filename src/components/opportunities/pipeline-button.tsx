"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { trackInPipeline } from "@/app/actions/opportunities";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function PipelineButton({ opportunityId, initial }: { opportunityId: string; initial: boolean }) {
  const [tracked, setTracked] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (tracked)
    return (
      <Link href="/dashboard/pipeline" className="block py-2 text-center text-sm font-semibold text-teal-700 hover:underline">
        Suivie dans votre pipeline →
      </Link>
    );
  return (
    <Button
      variant="outline"
      full
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await trackInPipeline(opportunityId);
          if (r.ok) setTracked(true);
          toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
        })
      }
    >
      <KanbanSquare className="size-4" aria-hidden /> Suivre dans mon pipeline
    </Button>
  );
}

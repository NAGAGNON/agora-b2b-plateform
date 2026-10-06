"use client";

import { useState } from "react";
import { Edit, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SourceForm, type SourceValues } from "@/components/admin/source-form";

export function SourceEditButton({ v }: { v?: SourceValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={v ? "outline" : "primary"} onClick={() => setOpen(true)}>
        {v ? <Edit className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />} {v ? "Modifier" : "Nouvelle source"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={v ? `Source : ${v.name}` : "Nouvelle source externe"} className="max-w-2xl">
        <SourceForm v={v} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

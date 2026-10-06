"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUploader } from "@/components/ui/file-uploader";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { uploadFiles } from "@/lib/direct-upload";

export function DocumentUploadForm({ opportunityId }: { opportunityId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [key, setKey] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-4 space-y-3">
      <FileUploader key={key} maxFiles={5} onChange={setFiles} />
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.text}</Notice>}
      <Button
        size="sm"
        variant="outline"
        disabled={pending || files.length === 0}
        onClick={() =>
          start(async () => {
            const { uploaded, errors } = await uploadFiles("opportunity", opportunityId, files);
            setResult(errors.length ? { ok: false, text: errors.join(" ") } : { ok: true, text: `${uploaded.length} document(s) ajouté(s).` });
            setFiles([]);
            setKey((k) => k + 1);
            router.refresh();
          })
        }
      >
        {pending ? "Envoi…" : "Ajouter les documents"}
      </Button>
    </div>
  );
}

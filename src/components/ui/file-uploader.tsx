"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

/**
 * Sélecteur de fichiers avec contrôle immédiat (type, taille). Le contrôle de
 * sécurité définitif (signature binaire, droits) est refait côté serveur.
 */
export function FileUploader({
  name = "files",
  multiple = true,
  maxFiles = 5,
  accept = Object.keys(ALLOWED_DOCUMENT_TYPES),
  maxBytes = MAX_DOCUMENT_BYTES,
  label = "Ajouter des documents",
}: {
  name?: string;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string[];
  maxBytes?: number;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function sync(next: File[]) {
    setFiles(next);
    if (!input.current) return;
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    input.current.files = dt.files;
  }

  function onChange(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const bad = incoming.find((f) => !accept.includes(f.type) || f.size > maxBytes);
    if (bad) {
      setError(!accept.includes(bad.type) ? `« ${bad.name} » : type de fichier non autorisé.` : `« ${bad.name} » dépasse ${formatBytes(maxBytes)}.`);
      sync(files);
      return;
    }
    setError(null);
    const merged = multiple ? [...files, ...incoming].slice(0, maxFiles) : incoming.slice(0, 1);
    sync(merged);
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 transition hover:border-teal hover:bg-teal-50">
        <Upload className="size-6 text-teal-700" aria-hidden />
        <span className="font-semibold text-navy">{label}</span>
        <span className="text-xs">
          {Object.values(ALLOWED_DOCUMENT_TYPES).join(", ")} — {formatBytes(maxBytes)} max{multiple ? `, ${maxFiles} fichiers max` : ""}
        </span>
        <input ref={input} type="file" name={name} multiple={multiple} accept={accept.join(",")} className="sr-only" onChange={(e) => onChange(e.target.files)} />
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-slate-500">{formatBytes(f.size)}</span>
              <button type="button" onClick={() => sync(files.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label={`Retirer ${f.name}`}>
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

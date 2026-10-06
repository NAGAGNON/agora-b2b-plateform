import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-navy placeholder:text-slate-400 shadow-sm transition focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 disabled:bg-slate-50 aria-[invalid=true]:border-red-500";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-navy", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm text-slate", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-slate-300 accent-teal" {...props} />
      <span>
        <span className="text-navy">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

type FieldProps = {
  label: ReactNode;
  name: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string; required?: boolean }) => ReactNode;
};

/** Champ de formulaire accessible : libellé, aide et erreur reliés au contrôle. */
export function Field({ label, name, error, hint, required, className, children }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden> *</span>}
      </Label>
      {children({ id, name, "aria-invalid": Boolean(error), "aria-describedby": describedBy, required })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

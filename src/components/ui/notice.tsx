import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";
const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-sky-200 bg-sky text-navy", Icon: Info },
  success: { box: "border-teal/40 bg-teal-50 text-teal-700", Icon: CheckCircle2 },
  warning: { box: "border-amber-300 bg-amber-50 text-amber-900", Icon: AlertTriangle },
  error: { box: "border-red-200 bg-red-50 text-red-800", Icon: XCircle },
};

export function Notice({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", box, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}

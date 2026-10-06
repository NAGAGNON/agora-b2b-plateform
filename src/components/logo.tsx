import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Logo officiel LinkProB2B (fichiers fournis dans public/brand). */
export function Logo({ variant = "color", className, withTagline = false }: { variant?: "color" | "white"; className?: string; withTagline?: boolean }) {
  if (withTagline) {
    return (
      <Image
        src={variant === "white" ? "/brand/logo-white.png" : "/brand/logo.png"}
        alt="LinkProB2B — Des opportunités qui créent des connexions"
        width={834}
        height={167}
        className={cn("h-auto w-56", className)}
        priority
      />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src={variant === "white" ? "/brand/logo-mark-white.png" : "/brand/logo-mark.png"} alt="" width={210} height={152} className="h-8 w-auto" priority />
      <span className={cn("font-heading text-xl font-extrabold tracking-tight", variant === "white" ? "text-white" : "text-navy")}>
        LinkPro<span className="text-teal">B2B</span>
      </span>
    </span>
  );
}

export function LogoLink({ variant = "color" }: { variant?: "color" | "white" }) {
  return (
    <Link href="/" aria-label="LinkProB2B — accueil" className="shrink-0">
      <Logo variant={variant} />
    </Link>
  );
}

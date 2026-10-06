import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-teal text-white hover:bg-teal-600 shadow-sm",
  secondary: "bg-navy text-white hover:bg-navy-700 shadow-sm",
  outline: "border border-slate-300 bg-white text-navy hover:border-navy hover:bg-sky",
  ghost: "text-navy hover:bg-sky",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  light: "bg-white text-navy hover:bg-sky shadow-sm",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClasses({ variant = "primary", size = "md", full = false, className }: { variant?: Variant; size?: Size; full?: boolean; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
    variants[variant],
    sizes[size],
    full && "w-full",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; full?: boolean };

export function Button({ variant, size, full, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, full, className })} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; full?: boolean };

export function ButtonLink({ variant, size, full, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, full, className })} {...props} />;
}

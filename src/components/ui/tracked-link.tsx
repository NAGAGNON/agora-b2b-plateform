"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import { trackCta } from "@/app/actions/cta";
import { buttonClasses } from "@/components/ui/button";

type Props = ComponentProps<typeof Link> & { cta: string };

/** Lien mesuré : le clic est enregistré sans retarder la navigation. */
export function TrackedLink({ cta, onClick, ...props }: Props) {
  const pathname = usePathname();
  return (
    <Link
      data-cta={cta}
      onClick={(e) => {
        void trackCta(cta, pathname).catch(() => {});
        onClick?.(e);
      }}
      {...props}
    />
  );
}

/** Bouton-lien mesuré, mêmes variantes que ButtonLink. */
export function TrackedButtonLink({
  variant,
  size,
  full,
  className,
  ...props
}: Props & Parameters<typeof buttonClasses>[0]) {
  return <TrackedLink className={buttonClasses({ variant, size, full, className })} {...props} />;
}

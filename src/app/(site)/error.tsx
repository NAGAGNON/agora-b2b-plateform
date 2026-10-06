"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page max-w-2xl py-16">
      <ErrorState
        description={
          <>
            Un problème technique est survenu. Réessayez dans un instant.
            {error.digest && <span className="mt-2 block text-xs">Référence : {error.digest}</span>}
          </>
        }
        action={<Button onClick={reset}>Réessayer</Button>}
      />
    </div>
  );
}

import Link from "next/link";

/** Rappel discret des documents applicables, sous un formulaire. */
export function LegalNote({ children, privacy = true }: { children?: React.ReactNode; privacy?: boolean }) {
  return (
    <p className="text-xs text-slate-500">
      {children ?? "Utilisation soumise aux"}{" "}
      <Link href="/cgu" className="underline hover:text-navy">
        Conditions Générales d&apos;Utilisation
      </Link>
      {privacy && (
        <>
          {" "}
          · Vos données :{" "}
          <Link href="/confidentialite" className="underline hover:text-navy">
            Politique de confidentialité
          </Link>
        </>
      )}
      .
    </p>
  );
}

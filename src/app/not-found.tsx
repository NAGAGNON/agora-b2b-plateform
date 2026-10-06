import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <Link href="/" className="font-semibold text-teal-700 underline">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}

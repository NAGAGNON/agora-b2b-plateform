/**
 * Nom fixe du cookie de session, partagé par le serveur et le navigateur (temps réel).
 * Par défaut, Supabase le dérive de l'URL du projet : le serveur peut joindre la base
 * par une URL interne (SUPABASE_INTERNAL_URL) différente de l'URL publique.
 */
export const SESSION_COOKIE = "sb-linkprob2b-auth-token";

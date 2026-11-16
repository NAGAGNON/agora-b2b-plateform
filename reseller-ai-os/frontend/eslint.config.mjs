import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  ...next,
  {
    rules: {
      // Textes en français : apostrophes droites dans le JSX (sans risque, pas de HTML injecté)
      "react/no-unescaped-entities": "off",
      // Images fournisseurs / photos du stock : domaines arbitraires, next/image inadapté
      "@next/next/no-img-element": "off",
      // Chargement de données / initialisation depuis le DOM dans des effets : motif voulu et borné
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**"]),
]);

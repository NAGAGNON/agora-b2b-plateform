/** Suivi « Google, articles et inscriptions » (fonction SQL seo_snapshot / admin_seo_snapshot). */
export type SeoSnapshot = {
  google: { today: number; yesterday: number; last_7_days: number; landing_today: { path: string; visits: number }[] };
  articles: {
    title: string;
    slug: string;
    published_at: string;
    published: "today" | "yesterday";
    views_today: number;
    views_yesterday: number;
    views_total: number;
    visitors_total: number;
    visitors_from_google: number;
  }[];
  signups: { today: number; from_outreach: number; list: { name: string | null; company: string | null; at: string; from_outreach: boolean }[] };
};

export const emptySeoSnapshot = (): SeoSnapshot => ({
  google: { today: 0, yesterday: 0, last_7_days: 0, landing_today: [] },
  articles: [],
  signups: { today: 0, from_outreach: 0, list: [] },
});

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  /** RSS body when the feed includes HTML (e.g. Substack `content:encoded`). */
  contentHtml?: string;
};

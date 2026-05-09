export type NewsItem = {
  title: string;
  link: string;
  source: string;
  /** RSS body when the feed includes HTML (e.g. Substack `content:encoded`). */
  contentHtml?: string;
  /** Plain preview from `description` or the start of the article body. */
  excerpt?: string;
};

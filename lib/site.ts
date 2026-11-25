/**
 * Canonical public origin, without trailing slash. The site is served at
 * www.tenplanner.com (tenplanner.com redirects there with a 308), so
 * canonical URLs and the sitemap must use the www host or Google sees
 * redirects instead of pages.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.tenplanner.com";

/** Canonical public origin, without trailing slash. tenplanner.com is the primary domain. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://tenplanner.com";

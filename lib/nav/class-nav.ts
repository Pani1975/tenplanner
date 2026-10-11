import { db } from "@/db";
import { classes } from "@/db/schema";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";

export type ClassNavParams = Record<string, string | string[] | undefined>;

const TABS = ["all", "library", "mine", "favorites", "drafts"] as const;

function paramList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export const CLASS_SORTS = ["alpha", "popular", "recent", "oldest"] as const;
export type ClassSort = (typeof CLASS_SORTS)[number];

export function parseClassSort(params: ClassNavParams): ClassSort {
  const v = typeof params.sort === "string" ? params.sort : "";
  return (CLASS_SORTS as readonly string[]).includes(v)
    ? (v as ClassSort)
    : "alpha";
}

/** Times a session has been created from this class — used to rank "más populares". */
const CLASS_POPULARITY_SQL = sql`(select count(*)::int from sessions s where s.source_class_id = ${classes.id})`;

/**
 * Returns the ORDER BY clauses for a given sort mode. Shared by the list
 * page's display query and the nav-ids query so pagination and Next/Previous
 * always reflect the same order the coach sees on screen.
 */
export function classOrderBy(sort: ClassSort) {
  switch (sort) {
    case "popular":
      return [sql`${CLASS_POPULARITY_SQL} desc`, desc(classes.createdAt)];
    case "recent":
      return [desc(classes.createdAt)];
    case "oldest":
      return [asc(classes.createdAt)];
    case "alpha":
    default:
      return [asc(classes.name)];
  }
}

/**
 * Returns the ordered list of class ids matching the same filters as the
 * /classes list page (app/(public)/classes/page.tsx), used to compute
 * Next/Previous navigation on the class detail page.
 *
 * IMPORTANT: keep this in sync with the filter logic in that page.
 */
export async function getFilteredClassIds(
  params: ClassNavParams,
  opts: { userId: string | null }
): Promise<string[]> {
  const { userId } = opts;

  const requestedTab = (params.tab as string) ?? "all";
  const tab = TABS.includes(requestedTab as (typeof TABS)[number])
    ? (requestedTab as (typeof TABS)[number])
    : "all";
  const activeTab =
    !userId && (tab === "mine" || tab === "favorites") ? "all" : tab;

  if (activeTab === "drafts") return [];

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const nivel = typeof params.nivel === "string" ? params.nivel : "";
  const duracion = typeof params.duracion === "string" ? params.duracion : "";
  const aspectoList = paramList(params.aspecto);
  const golpeList = paramList(params.golpe);

  const activeClubId = userId ? await getActiveWorkClubId(userId) : null;
  const mineOrClub = userId
    ? sharedWithClubCondition(
        classes.createdBy,
        classes.clubId,
        userId,
        activeClubId
      )
    : null;

  const conds: SQL[] = [eq(classes.status, "published")];
  if (activeTab === "mine" && userId) {
    conds.push(mineOrClub!);
  } else if (activeTab === "library") {
    conds.push(eq(classes.isLibrary, true));
  } else if (activeTab === "favorites" && userId) {
    conds.push(
      sql`${classes.id} IN (SELECT class_id FROM class_favorites WHERE user_id = ${userId})`
    );
  } else {
    conds.push(
      userId
        ? or(eq(classes.isLibrary, true), mineOrClub!)!
        : eq(classes.isLibrary, true)
    );
  }
  if (q) conds.push(ilike(classes.name, `%${q}%`));
  if (nivel) {
    conds.push(
      or(
        sql`${classes.niveles} @> ${JSON.stringify([nivel])}::jsonb`,
        eq(classes.nivel, nivel)
      )!
    );
  }
  if (aspectoList.length > 0) {
    conds.push(
      or(
        ...aspectoList.map(
          (a) =>
            or(
              sql`${classes.aspectosJuego} @> ${JSON.stringify([a])}::jsonb`,
              eq(classes.aspectoJuego, a)
            )!
        )
      )!
    );
  }
  if (duracion === "120") {
    conds.push(sql`${classes.duracionMinutes} > 90`);
  } else if (duracion) {
    const d = Number(duracion);
    if (Number.isFinite(d)) conds.push(eq(classes.duracionMinutes, d));
  }
  if (golpeList.length > 0) {
    conds.push(
      or(
        ...golpeList.map(
          (g) => sql`${classes.golpes}::jsonb @> ${`["${g}"]`}::jsonb`
        )
      )!
    );
  }

  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(...conds))
    .orderBy(...classOrderBy(parseClassSort(params)))
    .limit(2000);

  return rows.map((r) => r.id);
}

/** Query-string keys the /classes list uses for filtering. */
export function classNavQueryString(params: ClassNavParams): string {
  const p = new URLSearchParams();
  if (params.tab && params.tab !== "all") p.set("tab", params.tab as string);
  if (params.q) p.set("q", params.q as string);
  if (params.nivel) p.set("nivel", params.nivel as string);
  if (params.duracion) p.set("duracion", params.duracion as string);
  for (const v of paramList(params.aspecto)) p.append("aspecto", v);
  for (const v of paramList(params.golpe)) p.append("golpe", v);
  const sort = parseClassSort(params);
  if (sort !== "alpha") p.set("sort", sort);
  return p.toString();
}

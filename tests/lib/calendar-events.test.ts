import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { calendarEventsVisibility } from "@/lib/calendar-events";

const dialect = new PgDialect();
const sqlOf = (c: ReturnType<typeof calendarEventsVisibility>) =>
  dialect.sqlToQuery(c!).sql;

describe("calendarEventsVisibility", () => {
  it("fuera del Espacio gestión oculta los eventos de gestión", () => {
    expect(sqlOf(calendarEventsVisibility("u1", "c1", false))).toContain(
      '"calendar_events"."management" = $'
    );
  });

  it("en el Espacio gestión añade los eventos de gestión propios", () => {
    const q = sqlOf(calendarEventsVisibility("u1", "c1", true));
    expect(q).toContain(" or ");
    expect(q).toContain('"calendar_events"."user_id" = $');
  });
});

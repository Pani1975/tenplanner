// Ayudantes comunes de las rutas de gestión de torneos: sesión obligatoria,
// organizador según el modo de trabajo y errores con código.

import { NextResponse } from "next/server";
import { ZodError, type ZodType, type output } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrganizer, TournamentError, type Organizer } from "./server";

export async function withOrganizer(
  handler: (o: Organizer) => Promise<Response>
): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await handler(await getOrganizer(user.id));
  } catch (e) {
    if (e instanceof TournamentError) {
      return NextResponse.json(
        { error: e.code, detail: e.detail ?? null },
        { status: e.status }
      );
    }
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_input", detail: e.issues },
        { status: 400 }
      );
    }
    console.error("[tournaments]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function parseBody<S extends ZodType>(
  request: Request,
  schema: S
): Promise<output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new TournamentError("invalid_json", 400);
  }
  return schema.parse(raw);
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Ids de la URL: si no es un uuid, 404 (y sin error de la base). */
export function checkIds(...ids: string[]) {
  if (!ids.every((id) => UUID.test(id))) {
    throw new TournamentError("not_found", 404);
  }
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } }
  );

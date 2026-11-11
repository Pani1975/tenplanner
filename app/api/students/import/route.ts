import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { groupStudents, groups, students } from "@/db/schema";
import { getClubAccountClubId } from "@/lib/clubs";
import { geocodeLocality } from "@/lib/geo/geocode";
import { getActiveSport } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import { HOW_FOUND_IDS } from "@/lib/students/membership";
import {
  duplicateKey,
  IMPORT_MAX_ROWS,
  normalizeText,
} from "@/lib/students/import";
import { playerLevelSchema, rejectInvalidPlayerLevels } from "../validation";

// Importación de alumnos en bloque desde un Excel o CSV ya leído en el
// navegador. Solo la cuenta del club (gestor). Sin IA: el servidor vuelve a
// validar cada fila y detecta los que ya existen en el club.

/** Localidades nuevas que se sitúan en el mapa en cada importación. */
const MAX_GEOCODE = 5;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const optionalText = (max: number) => z.string().trim().max(max).nullable();

const rowSchema = z.object({
  name: z.string().trim().min(1).max(255),
  firstName: z.string().trim().min(1).max(255),
  lastName: optionalText(255),
  email: z.string().trim().email().max(255).nullable(),
  phone: optionalText(32),
  birthDate: isoDate,
  gender: z.enum(["male", "female", "other"]).nullable(),
  dominantHand: z.enum(["left", "right"]).nullable(),
  playerLevel: playerLevelSchema.nullable(),
  locality: optionalText(120),
  preferredSchedule: optionalText(500),
  joinedAt: isoDate,
  howFound: z.enum(HOW_FOUND_IDS).nullable(),
  howFoundDetail: optionalText(255),
  group: optionalText(255),
  heightCm: z.number().int().min(80).max(230).nullable(),
  weightKg: z.number().int().min(12).max(200).nullable(),
  notes: optionalText(2000),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(IMPORT_MAX_ROWS),
  /** true = solo comprobar (vista previa), sin guardar nada. */
  dryRun: z.boolean().default(false),
});

type Row = z.infer<typeof rowSchema>;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clubId = await getClubAccountClubId(user.id);
  if (!clubId) {
    return NextResponse.json(
      { error: "Solo el gestor del club puede importar alumnos" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const rowIndex =
      issue?.path[0] === "rows" && typeof issue.path[1] === "number"
        ? issue.path[1]
        : null;
    return NextResponse.json(
      {
        error:
          rowIndex !== null
            ? `Fila ${rowIndex + 1} de la importación: ${issue.path.slice(2).join(".")} no válido`
            : "Datos de importación no válidos",
      },
      { status: 400 }
    );
  }
  const { rows, dryRun } = parsed.data;

  const badLevel = await rejectInvalidPlayerLevels(
    rows.map((r) => r.playerLevel)
  );
  if (badLevel) return badLevel;

  try {
    // Alumnos que ya existen en el club: mismo nombre y fecha de
    // nacimiento, o mismo email.
    const existing = await db
      .select({
        name: students.name,
        birthDate: students.birthDate,
        email: students.email,
      })
      .from(students)
      .where(eq(students.clubId, clubId));
    const existingKeys = new Set(
      existing.map((s) => duplicateKey(s.name, s.birthDate))
    );
    const existingEmails = new Set(
      existing.map((s) => s.email?.toLowerCase()).filter(Boolean)
    );
    const duplicates = rows
      .map((r, i) =>
        existingKeys.has(duplicateKey(r.name, r.birthDate)) ||
        (r.email && existingEmails.has(r.email.toLowerCase()))
          ? i
          : -1
      )
      .filter((i) => i >= 0);

    const duplicateSet = new Set(duplicates);
    const toCreate = rows.filter((_, i) => !duplicateSet.has(i));
    const groupNames = new Map<string, string>();
    for (const r of toCreate)
      if (r.group) groupNames.set(normalizeText(r.group), r.group);

    const clubGroups = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.clubId, clubId));
    const groupIdByKey = new Map(
      clubGroups.map((g) => [normalizeText(g.name), g.id])
    );
    const newGroups = [...groupNames.entries()].filter(
      ([key]) => !groupIdByKey.has(key)
    );

    if (dryRun) {
      return NextResponse.json({
        data: {
          duplicates,
          toCreate: toCreate.length,
          newGroups: newGroups.map(([, name]) => name),
        },
      });
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        data: {
          created: 0,
          skipped: duplicates.length,
          groupsCreated: 0,
          located: 0,
        },
      });
    }

    // Procedencia: se reutilizan las coordenadas de alumnos del club con la
    // misma localidad; las demás se buscan (unas pocas por importación).
    const localities = new Map<string, string>();
    for (const r of toCreate)
      if (r.locality) localities.set(normalizeText(r.locality), r.locality);
    const coords = new Map<string, { lat: number; lng: number }>();
    if (localities.size) {
      const known = await db
        .select({
          locality: students.locality,
          lat: students.localityLat,
          lng: students.localityLng,
        })
        .from(students)
        .where(
          and(
            eq(students.clubId, clubId),
            isNotNull(students.locality),
            isNotNull(students.localityLat)
          )
        );
      for (const k of known)
        if (k.locality && k.lat !== null && k.lng !== null)
          coords.set(normalizeText(k.locality), { lat: k.lat, lng: k.lng });
      let lookups = 0;
      for (const [key, name] of localities) {
        if (coords.has(key) || lookups >= MAX_GEOCODE) continue;
        lookups += 1;
        const geo = await geocodeLocality(name);
        if (geo) coords.set(key, geo);
      }
    }

    const sport = await getActiveSport(user.id);
    const result = await db.transaction(async (tx) => {
      for (const [key, name] of newGroups) {
        const [g] = await tx
          .insert(groups)
          .values({ coachId: user.id, name, clubId, sport })
          .returning({ id: groups.id });
        groupIdByKey.set(key, g.id);
      }

      const inserted: { id: string; row: Row }[] = [];
      for (let i = 0; i < toCreate.length; i += 500) {
        const chunk = toCreate.slice(i, i + 500);
        const ids = await tx
          .insert(students)
          .values(
            chunk.map((r) => {
              const geo = r.locality
                ? coords.get(normalizeText(r.locality))
                : undefined;
              return {
                coachId: user.id,
                clubId,
                name: r.name,
                firstName: r.firstName,
                lastName: r.lastName,
                email: r.email,
                phone: r.phone,
                birthDate: r.birthDate,
                gender: r.gender,
                dominantHand: r.dominantHand,
                playerLevel: r.playerLevel,
                locality: r.locality,
                localityLat: geo?.lat ?? null,
                localityLng: geo?.lng ?? null,
                preferredSchedule: r.preferredSchedule,
                ...(r.joinedAt ? { joinedAt: r.joinedAt } : {}),
                howFound: r.howFound,
                howFoundDetail: r.howFoundDetail,
                heightCm: r.heightCm,
                weightKg: r.weightKg,
                notes: r.notes,
              };
            })
          )
          .returning({ id: students.id });
        ids.forEach((row, j) => inserted.push({ id: row.id, row: chunk[j] }));
      }

      const memberships = inserted
        .filter((s) => s.row.group)
        .map((s) => ({
          groupId: groupIdByKey.get(normalizeText(s.row.group!))!,
          studentId: s.id,
        }));
      for (let i = 0; i < memberships.length; i += 500) {
        await tx
          .insert(groupStudents)
          .values(memberships.slice(i, i + 500))
          .onConflictDoNothing();
      }
      return inserted;
    });

    const located = result.filter(
      (s) => s.row.locality && coords.has(normalizeText(s.row.locality))
    ).length;
    return NextResponse.json(
      {
        data: {
          created: result.length,
          skipped: duplicates.length,
          groupsCreated: newGroups.length,
          located,
          withLocality: result.filter((s) => s.row.locality).length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[students import] failed", err);
    return NextResponse.json(
      { error: "No se pudo importar. No se ha guardado ningún alumno." },
      { status: 500 }
    );
  }
}

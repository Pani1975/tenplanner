import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { landingContent, users } from "@/db/schema";
import {
  LANDING_FIELD_DEFINITIONS,
  LANDING_STRING_KEYS,
  type LandingStringKey,
} from "@/lib/landing-content";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return row?.isAdmin ? user : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(landingContent);
  return NextResponse.json({ data: rows });
}

const stringKeySchema = z.enum(
  LANDING_STRING_KEYS as [LandingStringKey, ...LandingStringKey[]]
);

const keySchema = stringKeySchema;

const maxLengthByKey = Object.fromEntries(
  LANDING_FIELD_DEFINITIONS.map((field) => [field.key, field.maxLength])
) as Record<LandingStringKey, number>;

function normalizeLandingValue(
  key: LandingStringKey,
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length < 1 || normalized.length > maxLengthByKey[key]) {
    return null;
  }
  return normalized;
}

function revalidateLanding() {
  revalidateTag("landing", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin/landing");
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z
    .union([
      z.object({
        key: keySchema,
        value: z.unknown(),
      }),
      z.object({
        updates: z
          .record(keySchema, z.unknown())
          .refine(
            (updates) => Object.keys(updates).length > 0,
            "At least one update is required"
          ),
      }),
    ])
    .safeParse(body);

  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  try {
    const updates =
      "updates" in parsed.data
        ? parsed.data.updates
        : { [parsed.data.key]: parsed.data.value };

    const rows = Object.entries(updates).map(([key, value]) => {
      const parsedKey = key as LandingStringKey;
      const normalized = normalizeLandingValue(parsedKey, value);
      if (normalized === null) {
        throw new Error(`Invalid value for ${key}`);
      }
      return {
        key,
        value: normalized,
        type: "string",
        label: LANDING_FIELD_DEFINITIONS.find(
          (field) => field.key === parsedKey
        )?.label,
        updatedBy: admin.id,
      };
    });

    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(landingContent)
          .values(row)
          .onConflictDoUpdate({
            target: landingContent.key,
            set: {
              value: row.value,
              type: row.type,
              label: row.label,
              updatedAt: new Date(),
              updatedBy: admin.id,
            },
          });
      }
    });

    revalidateLanding();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid landing content" },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPlayerTask, playerTaskSchema } from "@/lib/players/tasks";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = playerTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_input" },
      { status: 422 }
    );
  return NextResponse.json({ task: await createPlayerTask(user.id, parsed.data) }, { status: 201 });
}

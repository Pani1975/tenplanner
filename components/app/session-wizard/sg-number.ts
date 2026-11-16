/**
 * Número de la sesión sin grupo de cada día (1 = "SG", 2 = "SG2"…): las que
 * el monitor ya tiene ese día + 1. Si no se puede consultar, 1.
 */
export async function fetchSgNumbers(
  dates: Date[],
  excludeSessionId?: string | null
): Promise<number[]> {
  const days = dates.map((d) => {
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  try {
    const res = await fetch("/api/sessions/sg-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, excludeSessionId: excludeSessionId ?? null }),
    });
    if (!res.ok) return dates.map(() => 1);
    const json = (await res.json()) as { data?: { counts?: number[] } };
    const counts = json.data?.counts ?? [];
    return dates.map((_, i) => (counts[i] ?? 0) + 1);
  } catch {
    return dates.map(() => 1);
  }
}

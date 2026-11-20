import { cookies } from "next/headers";
import { isSport, type Sport } from "@/lib/sport-constants";

export const PUBLIC_SPORT_COOKIE = "tp_sport";

/**
 * Deporte de un visitante anónimo en la biblioteca pública. Ten Planner es
 * solo de tenis, así que no se pregunta: se usa la cookie `tp_sport` si
 * existe y es válida, y si no, tenis.
 */
export async function getPublicSportCookie(): Promise<Sport> {
  const store = await cookies();
  const value = store.get(PUBLIC_SPORT_COOKIE)?.value;
  return value && isSport(value) ? value : "tenis";
}

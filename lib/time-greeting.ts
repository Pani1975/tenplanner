/** Clave del saludo (traducible) según la hora. */
export function greetingKeyForHour(hour: number) {
  if (hour >= 6 && hour < 13) return "morning";
  if (hour >= 13 && hour < 21) return "afternoon";
  return "evening";
}

export function greetingForHour(hour: number) {
  if (hour >= 6 && hour < 13) return "Buenos días";
  if (hour >= 13 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

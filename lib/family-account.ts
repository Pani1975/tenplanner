/**
 * Tipo de cuenta que el usuario eligió al registrarse como familia o
 * jugador (user_metadata.account_type). Solo afecta a qué menú ve: no da
 * ni quita ningún permiso.
 */
export function isFamilyAccountType(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  const type = metadata?.account_type;
  return type === "familia" || type === "jugador";
}

/** Se registró "Como jugador" (mayor de edad que gestiona su cuenta). */
export function isPlayerAccountType(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  return metadata?.account_type === "jugador";
}

/**
 * Autoría de lo que crea un usuario que no es administrador: "jugador" para
 * las cuentas de jugador (su espacio privado) y "libre" para el resto.
 */
export function defaultAutoriaFor(
  metadata: Record<string, unknown> | null | undefined
): "jugador" | "libre" {
  return isPlayerAccountType(metadata) ? "jugador" : "libre";
}

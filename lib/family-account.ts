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

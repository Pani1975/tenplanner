/** A qué está vinculado un jugador: club y/o monitor (sin club). */
export type PlayerLinks = { club: boolean; monitor: boolean };
export const NO_PLAYER_LINKS: PlayerLinks = { club: false, monitor: false };

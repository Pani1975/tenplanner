"use client";

// Conector de las pantallas de torneos. Con cuenta: la API del servidor y
// router.refresh(). En modo prueba (sin registro): un almacén en el
// navegador que responde igual que la API (lib/tournaments/guest).

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";

export type TournamentPaths = {
  list: string;
  create: string;
  detail: (id: string) => string;
};

export type TournamentApi = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  refresh: () => void;
  /** Sin cuenta: sin alumnos, pistas, calendario ni página pública. */
  guest: boolean;
  paths: TournamentPaths;
};

const ACCOUNT_PATHS: TournamentPaths = {
  list: "/torneos",
  create: "/torneos/nuevo",
  detail: (id) => `/torneos/${id}`,
};

export const GUEST_PATHS: TournamentPaths = {
  list: "/probar-torneos",
  create: "/probar-torneos/nuevo",
  detail: (id) => `/probar-torneos/${id}`,
};

const Ctx = createContext<Omit<TournamentApi, "paths"> & {
  paths: TournamentPaths;
} | null>(null);

export function TournamentApiProvider({
  value,
  children,
}: {
  value: TournamentApi;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTournamentApi(): TournamentApi {
  const router = useRouter();
  const custom = useContext(Ctx);
  return useMemo(
    () =>
      custom ?? {
        fetch: (input, init) => fetch(input, init),
        refresh: () => router.refresh(),
        guest: false,
        paths: ACCOUNT_PATHS,
      },
    [custom, router]
  );
}

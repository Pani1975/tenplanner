import { describe, expect, it } from "vitest";
import {
  activeWorkModeKey,
  workModeOptions,
  workModeRequestBody,
} from "@/lib/work-mode-options";

const paniagua = { id: "club-p", name: "Paniagua" };
const tenerife = { id: "club-t", name: "CT Tenerife" };

const names = (opts: { name: string }[]) => opts.map((o) => `Modo ${o.name}`);

describe("workModeOptions", () => {
  it("administrador con club propio: administrador, su club y gestión, sin particular", () => {
    expect(
      names(
        workModeOptions({
          clubs: [paniagua],
          isAdmin: true,
          clubAccountClubId: paniagua.id,
        })
      )
    ).toEqual(["Modo administrador", "Modo Paniagua", "Modo gestión"]);
  });

  it("administrador sin club propio: administrador, clubes y particular", () => {
    expect(
      names(
        workModeOptions({
          clubs: [tenerife],
          isAdmin: true,
          clubAccountClubId: null,
        })
      )
    ).toEqual(["Modo administrador", "Modo CT Tenerife", "Modo particular"]);
  });

  it("cuenta de club: su club y gestión, sin particular", () => {
    expect(
      names(
        workModeOptions({
          clubs: [tenerife],
          isAdmin: false,
          clubAccountClubId: tenerife.id,
        })
      )
    ).toEqual(["Modo CT Tenerife", "Modo gestión"]);
  });

  it("monitor invitado: el club y particular", () => {
    expect(
      names(
        workModeOptions({
          clubs: [tenerife],
          isAdmin: false,
          clubAccountClubId: null,
        })
      )
    ).toEqual(["Modo CT Tenerife", "Modo particular"]);
  });

  it("monitor sin club: solo particular", () => {
    expect(
      workModeOptions({ clubs: [], isAdmin: false, clubAccountClubId: null })
    ).toHaveLength(1);
  });
});

describe("activeWorkModeKey / workModeRequestBody", () => {
  it("prioriza administrador y gestión sobre el club activo", () => {
    expect(
      activeWorkModeKey({
        tenPlannerMode: false,
        managementMode: true,
        activeClubId: "club-t",
      })
    ).toBe("gestion");
    expect(
      activeWorkModeKey({
        tenPlannerMode: false,
        managementMode: false,
        activeClubId: null,
      })
    ).toBe("particular");
  });

  it("traduce la clave a la petición", () => {
    expect(workModeRequestBody("gestion")).toEqual({ mode: "gestion" });
    expect(workModeRequestBody("tenplanner")).toEqual({ mode: "tenplanner" });
    expect(workModeRequestBody("particular")).toEqual({ clubId: null });
    expect(workModeRequestBody("club-t")).toEqual({ clubId: "club-t" });
  });
});

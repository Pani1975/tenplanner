import { describe, expect, it } from "vitest";
import { clubValuesFromSignup } from "@/lib/club-signup";

describe("clubValuesFromSignup", () => {
  it("saca los datos del club de los metadatos del alta", () => {
    const v = clubValuesFromSignup(
      {
        club_name: "  Christian Larsen Tennis Academy ",
        club_seats: "4",
        club_address: "Av Palo Mayor 7",
        club_phone: "673284897",
        club_website: "",
      },
      "Christian@Gmail.com"
    );
    expect(v).toMatchObject({
      name: "Christian Larsen Tennis Academy",
      plannedCoachSeats: 4,
      address: "Av Palo Mayor 7",
      phone: "673284897",
      email: "christian@gmail.com",
    });
  });

  it("no es un alta de club sin nombre o con un nombre demasiado corto", () => {
    expect(clubValuesFromSignup({}, "a@b.com")).toBeNull();
    expect(clubValuesFromSignup(null, "a@b.com")).toBeNull();
    expect(clubValuesFromSignup({ club_name: "A" }, "a@b.com")).toBeNull();
    expect(clubValuesFromSignup({ club_name: 5 }, "a@b.com")).toBeNull();
  });

  it("los monitores previstos vacíos o no numéricos quedan en null", () => {
    expect(
      clubValuesFromSignup({ club_name: "CT Prueba", club_seats: "" }, null)
        ?.plannedCoachSeats
    ).toBeNull();
    expect(
      clubValuesFromSignup(
        { club_name: "CT Prueba", club_seats: "muchos" },
        null
      )?.plannedCoachSeats
    ).toBeNull();
    expect(
      clubValuesFromSignup({ club_name: "CT Prueba" }, null)?.email
    ).toBeNull();
  });
});

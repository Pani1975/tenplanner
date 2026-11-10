import { describe, expect, it } from "vitest";
import { clubIdentitySchema } from "@/lib/club-identity";

const base = {
  name: "Paniagua",
  fullName: null,
  address: null,
  phone: null,
  email: "info@club.com",
  website: null,
  coverImageUrl: null,
  photos: [],
  videos: [],
  courts: null,
  padelCourts: null,
  hasCafeteria: null,
  hasParking: null,
  foundedYear: null,
};

describe("clubIdentitySchema", () => {
  it("acepta la ficha mínima (nombre y email)", () => {
    expect(clubIdentitySchema.safeParse(base).success).toBe(true);
  });

  it("el email es obligatorio y válido", () => {
    expect(clubIdentitySchema.safeParse({ ...base, email: "" }).success).toBe(
      false
    );
    expect(
      clubIdentitySchema.safeParse({ ...base, email: "no-es-email" }).success
    ).toBe(false);
  });

  it("fotos y vídeos solo con enlaces http(s)", () => {
    expect(
      clubIdentitySchema.safeParse({
        ...base,
        photos: ["https://x.supabase.co/a.jpg"],
        videos: ["https://youtu.be/dQw4w9WgXcQ"],
      }).success
    ).toBe(true);
    expect(
      clubIdentitySchema.safeParse({ ...base, videos: ["javascript:alert(1)"] })
        .success
    ).toBe(false);
  });

  it("instalaciones: pádel, cafetería y aparcamiento", () => {
    expect(
      clubIdentitySchema.safeParse({
        ...base,
        padelCourts: 4,
        hasCafeteria: true,
        hasParking: false,
      }).success
    ).toBe(true);
  });
});

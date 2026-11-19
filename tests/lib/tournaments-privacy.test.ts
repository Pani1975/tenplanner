import { describe, expect, it } from "vitest";
import { canSeeContacts, redactEntry } from "@/lib/tournaments/privacy";

const entry = {
  id: "e1",
  firstName: "Lucía",
  lastName: "García",
  email: "lucia@x.com",
  phone: "+34600112233",
  guardianName: "Marta García",
  guardianEmail: "marta@x.com",
  guardianPhone: "+34600000000",
  partnerEmail: "p@x.com",
  partnerPhone: null,
  partnerGuardianName: null,
  partnerGuardianEmail: null,
  partnerGuardianPhone: null,
  consentByName: "Marta García",
  cancelToken: "secreto",
  status: "confirmed",
};

describe("canSeeContacts", () => {
  it("particular sí; club solo su administrador", () => {
    expect(canSeeContacts({ clubId: null, ownedClubId: null })).toBe(true);
    expect(canSeeContacts({ clubId: "c1", ownedClubId: "c1" })).toBe(true);
    expect(canSeeContacts({ clubId: "c1", ownedClubId: null })).toBe(false);
    expect(canSeeContacts({ clubId: "c1", ownedClubId: "c2" })).toBe(false);
  });
});

describe("redactEntry", () => {
  it("monitor del club: sin contactos ni token, con nombre y estado", () => {
    const r = redactEntry(entry, false);
    expect(r).toMatchObject({
      id: "e1",
      firstName: "Lucía",
      lastName: "García",
      status: "confirmed",
      email: null,
      phone: null,
      guardianName: null,
      guardianEmail: null,
      guardianPhone: null,
      partnerEmail: null,
      consentByName: null,
      cancelToken: null,
      contactsHidden: true,
    });
  });

  it("administrador: con contactos, pero nunca el token", () => {
    const r = redactEntry(entry, true);
    expect(r.email).toBe("lucia@x.com");
    expect(r.guardianPhone).toBe("+34600000000");
    expect(r.cancelToken).toBeNull();
    expect(r.contactsHidden).toBe(false);
  });

  it("no añade campos que no venían", () => {
    const r = redactEntry({ id: "e2", status: "waitlist" }, false);
    expect(r).toEqual({ id: "e2", status: "waitlist", contactsHidden: true });
  });
});

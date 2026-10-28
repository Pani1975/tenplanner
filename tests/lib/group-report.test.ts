import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildGroupReport } from "@/lib/groups/report";
import { GroupReportPdf } from "@/lib/groups/report-pdf";

const now = new Date("2026-10-20T12:00:00Z");
const past = (days: number) => new Date(now.getTime() - days * 86_400_000);
const future = (days: number) => new Date(now.getTime() + days * 86_400_000);

const members = [
  { id: "a", name: "Ana", playerLevel: "beginner" },
  { id: "b", name: "Luis", playerLevel: null },
];

describe("buildGroupReport", () => {
  it("cuenta impartidas, próximas y horas, ignorando canceladas", () => {
    const report = buildGroupReport({
      now,
      members,
      sessions: [
        {
          id: "s1",
          scheduledAt: past(7),
          durationMinutes: 60,
          status: "completed",
          intensity: 3,
        },
        {
          id: "s2",
          scheduledAt: past(2),
          durationMinutes: 90,
          status: "scheduled",
          intensity: 4,
        },
        {
          id: "s3",
          scheduledAt: past(1),
          durationMinutes: 60,
          status: "cancelled",
          intensity: null,
        },
        {
          id: "s4",
          scheduledAt: future(3),
          durationMinutes: 60,
          status: "scheduled",
          intensity: null,
        },
      ],
      records: [],
    });

    expect(report.taught).toBe(2);
    expect(report.upcoming).toBe(1);
    expect(report.hoursTaught).toBe(2.5);
    expect(report.unrecordedTaught).toBe(2);
    expect(report.attendanceRate).toBeNull();
    expect(report.avgIntensity).toBe(3.5);
  });

  it("calcula asistencia y valoración por alumno", () => {
    const report = buildGroupReport({
      now,
      members,
      sessions: [
        {
          id: "s1",
          scheduledAt: past(7),
          durationMinutes: 60,
          status: "completed",
          intensity: null,
        },
        {
          id: "s2",
          scheduledAt: past(2),
          durationMinutes: 60,
          status: "completed",
          intensity: null,
        },
      ],
      records: [
        { sessionId: "s1", studentId: "a", attended: true, rating: 4 },
        { sessionId: "s2", studentId: "a", attended: false, rating: null },
        { sessionId: "s1", studentId: "b", attended: true, rating: 5 },
      ],
    });

    const ana = report.students.find((s) => s.id === "a");
    const luis = report.students.find((s) => s.id === "b");
    expect(ana).toMatchObject({
      sessionsRecorded: 2,
      attended: 1,
      attendanceRate: 50,
      avgRating: 4,
    });
    expect(luis).toMatchObject({
      sessionsRecorded: 1,
      attended: 1,
      attendanceRate: 100,
      avgRating: 5,
    });
    expect(report.attendanceRate).toBe(67);
    expect(report.unrecordedTaught).toBe(0);
  });
});

describe("GroupReportPdf", () => {
  it("genera un PDF válido", async () => {
    const report = buildGroupReport({
      now,
      members,
      sessions: [
        {
          id: "s1",
          scheduledAt: past(7),
          durationMinutes: 60,
          status: "completed",
          intensity: 3,
        },
      ],
      records: [{ sessionId: "s1", studentId: "a", attended: true, rating: 4 }],
    });

    const element = createElement(GroupReportPdf, {
      groupName: "Juniors",
      coachName: "David",
      generatedAt: now,
      report,
    }) as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

import { z } from "zod";

const coord = z.number().min(-30).max(130);
const pt = z.tuple([coord, coord]);

const element = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("player"),
    at: pt,
    role: z.enum(["alumno", "monitor", "rival"]).optional(),
    label: z.string().max(2).optional(),
  }),
  z.object({ t: z.literal("ball"), at: pt }),
  z.object({ t: z.literal("basket"), at: pt }),
  z.object({ t: z.literal("cone"), at: pt }),
  z.object({ t: z.literal("hoop"), at: pt }),
  z.object({ t: z.literal("ladder"), from: pt, to: pt }),
  z.object({
    t: z.literal("zone"),
    from: pt,
    to: pt,
    label: z.string().max(14).optional(),
  }),
  z.object({
    t: z.literal("line"),
    from: pt,
    to: pt,
    dashed: z.boolean().optional(),
  }),
  z.object({ t: z.literal("move"), points: z.array(pt).min(2).max(8) }),
  z.object({ t: z.literal("shot"), points: z.array(pt).min(2).max(8) }),
  z.object({ t: z.literal("text"), at: pt, text: z.string().min(1).max(18) }),
]);

const choreoStep = z.object({
  text: z.string().max(90).optional(),
  dur: z.number().min(0.4).max(12).optional(),
  moves: z
    .array(z.object({ who: z.number().int().min(0).max(11), path: z.array(pt).min(2).max(12) }))
    .max(8)
    .optional(),
  ball: z
    .object({
      path: z.array(pt).min(2).max(12),
      bounces: z.array(z.number().int().min(1).max(11)).max(10).optional(),
    })
    .optional(),
  swing: z.number().int().min(0).max(11).optional(),
});

export const diagramSchema = z.object({
  court: z.enum(["tenis", "medio", "mini", "libre"]),
  elements: z.array(element).min(1).max(60),
  choreo: z.object({ steps: z.array(choreoStep).min(1).max(24) }).optional(),
  caption: z.string().max(90).optional(),
});

export const diagramMapSchema = z.record(z.string().uuid(), diagramSchema);

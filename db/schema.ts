import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  json,
  boolean,
  date,
  index,
  numeric,
  vector,
  uniqueIndex,
  jsonb,
  primaryKey,
  check,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { StationItemJson } from "@/lib/block-items";
import type { GroupScheduleEntry } from "@/lib/groups/schedule";

// Enums
export const exerciseCategoryEnum = pgEnum("exercise_category", [
  "technique",
  "tactics",
  "fitness",
  "warm-up",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const difficultyEnum = pgEnum("difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const trainingPhaseEnum = pgEnum("training_phase", [
  "activation",
  "main",
  "cooldown",
]);

export const ejercicioFormatoEnum = pgEnum("ejercicio_formato", [
  "individual",
  "parejas",
  "grupal",
  "multigrupo",
]);

export const tipoActividadEnum = pgEnum("tipo_actividad", [
  "tecnico_tactico",
  "fisico",
  "cognitivo",
  "competitivo",
  "ludico",
]);

export const tipoPelotaEnum = pgEnum("tipo_pelota", [
  "normal",
  "lenta",
  "rapida",
  "sin_pelota",
  "gomaespuma",
  "roja",
  "naranja",
  "verde",
  "amarilla",
]);

export const aiEmbeddingSourceEnum = pgEnum("ai_embedding_source", [
  "exercise",
  "session",
]);

export const devTaskAssigneeEnum = pgEnum("dev_task_assignee", [
  "dario",
  "david",
  "ambos",
]);

export const devTaskStatusEnum = pgEnum("dev_task_status", [
  "pendiente",
  "resuelto",
]);

export const clubMemberRoleEnum = pgEnum("club_member_role", [
  "owner",
  "coach",
]);

export const clubMemberStatusEnum = pgEnum("club_member_status", [
  "active",
  "removed",
]);

export const clubInviteStatusEnum = pgEnum("club_invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

// Multi-sport (PMV 261007) — tenis (ya implementado), pádel, pickleball y
// tenis playa comparten el mismo modelo de datos. El deporte es un contexto:
// se etiqueta en groups/classes/exercises/sessions/session_templates, y la
// vinculación monitor↔club es por (club, usuario, deporte).
export const sportEnum = pgEnum("sport", [
  "tenis",
  "padel",
  "pickleball",
  "tenis_playa",
]);

// Users — id references auth.users(id) managed by Supabase Auth
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    image: text("image"),
    city: varchar("city", { length: 255 }),
    role: varchar("role", { length: 20 }), // "player" | "coach" | "both"
    playerLevel: varchar("player_level", { length: 30 }), // "beginner" | "amateur" | "intermediate" | "advanced" | "competitive"
    yearsExperience: integer("years_experience"),
    surfacePreference: varchar("surface_preference", { length: 30 }), // "crystal" | "turf" | "cement" | "any"
    goals: text("goals"),
    isAdmin: boolean("is_admin").default(false).notNull(),
    // Modo de trabajo activo: null = particular/individual; si tiene valor,
    // todo lo que el usuario cree (sesiones, alumnos, clases, grupos,
    // eventos) se etiqueta automáticamente con este club y es visible para
    // el resto de miembros activos del club. Se elige y cambia desde el
    // perfil, no por elemento.
    activeClubId: uuid("active_club_id").references(
      (): AnyPgColumn => clubs.id,
      { onDelete: "set null" }
    ),
    // Deporte activo: el contexto que filtra todo lo que el usuario ve y
    // crea (sesiones, biblioteca, grupos...). Se elige y cambia desde el
    // selector de deporte, no por elemento. Independiente de activeClubId:
    // un usuario puede estar en modo club para un deporte y particular
    // para otro.
    activeSport: sportEnum("active_sport").default("tenis").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("users_active_club_id_idx").on(t.activeClubId)]
);

// Exercises
export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: exerciseCategoryEnum("category").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    objectives: text("objectives"),
    // Organización que muestra la animación de clase para este ejercicio
    // (una AnimationScene de lib/classes/animation.ts). Null = se deduce
    // del texto.
    animationScene: varchar("animation_scene", { length: 24 }),
    steps: json("steps").$type<Array<{ title: string; description: string }>>(),
    materials: json("materials").$type<string[]>(),
    imageUrl: text("image_url"),
    location: varchar("location", { length: 50 }),
    videoUrl: text("video_url"),
    tips: text("tips"),
    phase: trainingPhaseEnum("phase"),
    // Un ejercicio puede servir en varias fases (p. ej. calentamiento y vuelta
    // a la calma). `phase` guarda la primera para compatibilidad.
    fases: jsonb("fases").$type<string[]>(),
    intensity: integer("intensity"), // 1-5, app-validated
    formato: ejercicioFormatoEnum("formato"),
    numJugadores: integer("num_jugadores"),
    tipoPelota: tipoPelotaEnum("tipo_pelota"),
    tipoActividad: tipoActividadEnum("tipo_actividad"),
    golpes: json("golpes").$type<string[]>(),
    efecto: json("efecto").$type<string[]>(),
    variantes: text("variantes"),
    observaciones: text("observaciones"),
    imageUrls: json("image_urls").$type<string[]>(),
    // New taxonomy (PMV 260506) — additive, replaces difficulty/intensity in UI
    nivel: varchar("nivel", { length: 32 }), // descubrimiento|desarrollo|consolidacion|especializacion|precompeticion|competicion|adultos_iniciacion|adultos_medio_alto
    aspectoJuego: varchar("aspecto_juego", { length: 16 }), // tecnica|tactica|mental|fisico
    parametro: varchar("parametro", { length: 16 }), // altura|profundidad|velocidad|direccion
    tipologia: varchar("tipologia", { length: 16 }), // juego|reto|otros_deportes
    duracionRango: varchar("duracion_rango", { length: 16 }), // 1-5|5-10|10-15|15-20|+20
    niveles: jsonb("niveles").$type<string[]>(),
    aspectosJuego: jsonb("aspectos_juego").$type<string[]>(),
    parametros: jsonb("parametros").$type<string[]>(),
    tiposActividad: jsonb("tipos_actividad").$type<string[]>(),
    caracter: jsonb("caracter").$type<string[]>(),
    situacionJuego: jsonb("situacion_juego").$type<string[]>(),
    // Autoría del ejercicio/clase: "ten_planner" | "libre" | el id de un
    // monitor/academia dado de alta (p. ej. "academia_christian_larsen").
    // Texto libre (no enum) para poder añadir nuevas autorías sin migración.
    autoria: varchar("autoria", { length: 64 }).default("libre"),
    isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
    isGlobal: boolean("is_global").default(false).notNull(),
    // null = ejercicio del espacio particular de su autor. Se asigna cuando
    // el monitor lo crea trabajando como un club (modo de trabajo): queda
    // compartido con todos los miembros activos de ese club ("Mis
    // ejercicios" del espacio del club). Mismo criterio que classes.clubId.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    // Deporte al que pertenece el ejercicio. Default "tenis" para que todo
    // el contenido existente quede migrado sin tocar datos.
    sport: sportEnum("sport").default("tenis").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("exercises_created_by_idx").on(t.createdBy),
    index("exercises_created_by_name_idx").on(t.createdBy, t.name),
    index("exercises_is_global_idx").on(t.isGlobal),
    index("exercises_category_created_at_idx").on(t.category, t.createdAt),
    index("exercises_name_idx").on(t.name),
    index("exercises_autoria_idx").on(t.autoria),
    index("exercises_sport_idx").on(t.sport),
    index("exercises_club_id_idx").on(t.clubId),
  ]
);

// Places (coach-managed locations: Pista 1, Pista 2, Gimnasio…)
export const places = pgTable(
  "places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachId: uuid("coach_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("places_coach_id_idx").on(t.coachId),
    uniqueIndex("places_coach_name_uniq").on(t.coachId, t.name),
  ]
);

// Sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    objective: text("objective"),
    material: text("material"),
    observations: text("observations"),
    sourceClassId: uuid("source_class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    intensity: integer("intensity"), // 1-5, app-validated
    tags: json("tags").$type<string[]>(),
    location: varchar("location", { length: 50 }),
    placeId: uuid("place_id").references(() => places.id, {
      onDelete: "set null",
    }),
    // Grupo al que se imparte la sesión (se elige en el asistente). null =
    // sin grupo (alumnos sueltos o clase particular).
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    // null = particular (personal work). Set when the coach creates this
    // on behalf of a club they're linked to — the club only sees items
    // tagged with its own id, never the coach's other work.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    // Deporte de la sesión. Si viene de una clase/grupo, hereda el suyo al
    // crearse; default "tenis" para que lo existente migre sin tocar datos.
    sport: sportEnum("sport").default("tenis").notNull(),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    statusNote: text("status_note"), // notas de completada / motivo de cancelada
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_scheduled_at_idx").on(t.scheduledAt),
    index("sessions_user_scheduled_at_idx").on(t.userId, t.scheduledAt),
    index("sessions_place_id_idx").on(t.placeId),
    index("sessions_club_id_idx").on(t.clubId),
    index("sessions_sport_idx").on(t.sport),
    index("sessions_group_id_idx").on(t.groupId),
  ]
);

// Session Exercises (M:N pivot table)
export const sessionExercises = pgTable(
  "session_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    exerciseId: uuid("exercise_id")
      .references(() => exercises.id, { onDelete: "cascade" })
      .notNull(),
    orderIndex: integer("order_index").notNull(),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    phase: trainingPhaseEnum("phase"),
    intensity: integer("intensity"),
    coachRating: integer("coach_rating"), // 1-5 rating by coach after session
    actualDurationSeconds: integer("actual_duration_seconds"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    executionNotes: text("execution_notes"),
    wasSkipped: boolean("was_skipped").default(false).notNull(),
  },
  (t) => [
    index("session_exercises_session_id_idx").on(t.sessionId),
    index("session_exercises_session_order_idx").on(t.sessionId, t.orderIndex),
    index("session_exercises_exercise_id_idx").on(t.exerciseId),
  ]
);

// Session blocks are the stable PMV snapshot used when a class is scheduled.
export const sessionBlocks = pgTable(
  "session_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    orderIndex: integer("order_index").notNull(),
    title: varchar("title", { length: 120 }),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("session_blocks_session_order_uniq").on(
      t.sessionId,
      t.orderIndex
    ),
    index("session_blocks_session_id_idx").on(t.sessionId),
  ]
);

export const sessionBlockItems = pgTable(
  "session_block_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .references(() => sessionBlocks.id, { onDelete: "cascade" })
      .notNull(),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    exerciseName: varchar("exercise_name", { length: 255 }),
    exerciseDescription: text("exercise_description"),
    freeText: text("free_text"),
    // Título corto para items de texto libre (kind="text"), mostrado en
    // negrita igual que el nombre de un ejercicio de biblioteca. Opcional:
    // una anotación o actividad libre puede no llevar título.
    title: varchar("title", { length: 120 }),
    orderIndex: integer("order_index").notNull(),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    // "exercise"|"text"|"warmup"|"stations"; null = legacy (infer from
    // exerciseId/freeText).
    kind: varchar("kind", { length: 16 }),
    // Sub-items for kind="stations" (2-10 estaciones); see lib/block-items.ts.
    stations: jsonb("stations").$type<StationItemJson[]>(),
    // Aspecto del juego (tecnica|tactica|fisico|mental) para items de texto
    // libre sin ejercicio de biblioteca asociado: permite que las
    // estadísticas de la sesión cuenten su tiempo aunque no se haya creado
    // una ficha completa. Null para ejercicios de biblioteca (su aspecto
    // sale de exercises.aspecto_juego) y para items sin clasificar.
    aspectoJuego: varchar("aspecto_juego", { length: 16 }),
  },
  (t) => [
    index("session_block_items_block_id_idx").on(t.blockId),
    index("session_block_items_block_order_idx").on(t.blockId, t.orderIndex),
    index("session_block_items_exercise_id_idx").on(t.exerciseId),
  ]
);

// Students (managed by coaches)
export const students = pgTable(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachId: uuid("coach_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    gender: varchar("gender", { length: 20 }), // "male" | "female" | "other"
    birthDate: date("birth_date"),
    heightCm: integer("height_cm"),
    weightKg: integer("weight_kg"),
    dominantHand: varchar("dominant_hand", { length: 10 }), // "left" | "right"
    playerLevel: varchar("player_level", { length: 30 }), // ahora admite los 8 niveles PMV
    yearsExperience: integer("years_experience"),
    yearStartedTennis: integer("year_started_tennis"),
    yearStartedRacketSports: integer("year_started_racket_sports"),
    phone: varchar("phone", { length: 32 }),
    preferredSchedule: text("preferred_schedule"),
    notes: text("notes"),
    imageUrl: text("image_url"),
    profileToken: varchar("profile_token", { length: 128 }).unique(),
    profileTokenExpiresAt: timestamp("profile_token_expires_at", {
      withTimezone: true,
    }),
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
    consentVersion: varchar("consent_version", { length: 20 }),
    // null = particular student. Set when the coach adds this student on
    // behalf of a club they're linked to.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("students_coach_id_idx").on(t.coachId),
    index("students_coach_name_idx").on(t.coachId, t.name),
    index("students_club_id_idx").on(t.clubId),
  ]
);

// Catálogo de objetivos por etapa (bola roja / naranja / verde) y aspecto del
// juego. Basado en tenisXetapas (RFET): `source` indica si el objetivo recoge
// un punto de la RFET ("rfet"), es un desglose propuesto ("desglose") o lo ha
// creado un monitor ("propio").
export const tennisObjectives = pgTable(
  "tennis_objectives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    sport: text("sport").default("tenis").notNull(),
    ball: text("ball").notNull(), // "roja" | "naranja" | "verde"
    stage: text("stage").notNull(),
    ageRange: text("age_range").notNull(),
    aspect: text("aspect").notNull(), // "tecnico" | "tactico" | "mental" | "fisico"
    block: text("block").notNull(),
    title: text("title").notNull(),
    criterion: text("criterion"),
    source: text("source").default("desglose").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    // Ámbito: los tres a null = catálogo base de Ten Planner. Un objetivo propio
    // pertenece a UN solo ámbito: un club (todos sus alumnos), un monitor (sus
    // alumnos particulares, sin club) o un alumno concreto.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "cascade",
    }),
    coachId: uuid("coach_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "cascade",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("tennis_objectives_ball_aspect_idx").on(
      t.ball,
      t.aspect,
      t.sortOrder
    ),
    index("tennis_objectives_club_id_idx").on(t.clubId),
    index("tennis_objectives_coach_id_idx").on(t.coachId),
    index("tennis_objectives_student_id_idx").on(t.studentId),
    check(
      "tennis_objectives_single_scope_chk",
      sql`num_nonnulls(${t.clubId}, ${t.coachId}, ${t.studentId}) <= 1`
    ),
  ]
);

// Ajustes sobre un objetivo (base o propio) para un club, un monitor o un
// alumno. Cada campo a null = "sin cambio": gana el ajuste más específico
// (alumno > club/monitor > original). Borrar la fila restaura el original.
export const objectiveOverrides = pgTable(
  "objective_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    objectiveId: uuid("objective_id")
      .references(() => tennisObjectives.id, { onDelete: "cascade" })
      .notNull(),
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "cascade",
    }),
    coachId: uuid("coach_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "cascade",
    }),
    hidden: boolean("hidden"),
    title: text("title"),
    criterion: text("criterion"),
    // Posición de este objetivo dentro de su grupo para este ámbito.
    sortOrder: integer("sort_order"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("objective_overrides_club_uniq")
      .on(t.objectiveId, t.clubId)
      .where(sql`${t.clubId} is not null`),
    uniqueIndex("objective_overrides_coach_uniq")
      .on(t.objectiveId, t.coachId)
      .where(sql`${t.coachId} is not null`),
    uniqueIndex("objective_overrides_student_uniq")
      .on(t.objectiveId, t.studentId)
      .where(sql`${t.studentId} is not null`),
    index("objective_overrides_student_idx").on(t.studentId),
    check(
      "objective_overrides_single_scope_chk",
      sql`num_nonnulls(${t.clubId}, ${t.coachId}, ${t.studentId}) = 1`
    ),
  ]
);

// Objetivos marcados como conseguidos por alumno. Cualquier alumno puede tener
// marcado cualquier objetivo, sea de su bola o de otra.
export const studentObjectives = pgTable(
  "student_objectives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    objectiveId: uuid("objective_id")
      .references(() => tennisObjectives.id, { onDelete: "cascade" })
      .notNull(),
    achieved: boolean("achieved").default(true).notNull(),
    achievedAt: timestamp("achieved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    markedBy: uuid("marked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("student_objectives_student_id_objective_id_key").on(
      t.studentId,
      t.objectiveId
    ),
    index("student_objectives_student_idx").on(t.studentId),
  ]
);

// Session ↔ Students pivot
export const sessionStudents = pgTable(
  "session_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    attended: boolean("attended"),
    rating: integer("rating"),
    feedback: text("feedback"),
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("session_students_session_student_uniq").on(
      t.sessionId,
      t.studentId
    ),
    index("session_students_session_id_idx").on(t.sessionId),
    index("session_students_student_id_idx").on(t.studentId),
  ]
);

// Groups (coach-defined groups of students)
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachId: uuid("coach_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // null = particular group. Set when the coach creates this on behalf
    // of a club they're linked to.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    // Un deporte por grupo (fijo a la creación). Un alumno puede
    // pertenecer a varios grupos del mismo o de distinto deporte —
    // ver group_students, que no lleva sport.
    sport: sportEnum("sport").default("tenis").notNull(),
    // Días de la semana (y hora) en que el grupo tiene clase habitualmente;
    // ver lib/groups/schedule.ts. Null/[] = sin horario fijo configurado.
    weeklySchedule: jsonb("weekly_schedule").$type<GroupScheduleEntry[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("groups_coach_id_idx").on(t.coachId),
    index("groups_club_id_idx").on(t.clubId),
    index("groups_sport_idx").on(t.sport),
  ]
);

export const groupStudents = pgTable(
  "group_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("group_students_group_student_uniq").on(t.groupId, t.studentId),
    index("group_students_group_id_idx").on(t.groupId),
    index("group_students_student_id_idx").on(t.studentId),
  ]
);

// Session lists (listas de sesiones favoritas, p. ej. "Favoritas")
export const sessionLists = pgTable(
  "session_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 10 }).default("⭐"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("session_lists_user_id_idx").on(t.userId)]
);

export const sessionListItems = pgTable(
  "session_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .references(() => sessionLists.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("session_list_items_list_session_uniq").on(
      t.listId,
      t.sessionId
    ),
    index("session_list_items_list_id_idx").on(t.listId),
    index("session_list_items_session_id_idx").on(t.sessionId),
  ]
);

// Exercise ratings (1-5 per user)
export const exerciseRatings = pgTable(
  "exercise_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    exerciseId: uuid("exercise_id")
      .references(() => exercises.id, { onDelete: "cascade" })
      .notNull(),
    rating: integer("rating").notNull(), // 1-5
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("exercise_ratings_user_exercise_uniq").on(
      t.userId,
      t.exerciseId
    ),
    index("exercise_ratings_exercise_id_idx").on(t.exerciseId),
    index("exercise_ratings_user_id_idx").on(t.userId),
  ]
);

// Exercise lists (named collections of exercises)
export const exerciseLists = pgTable(
  "exercise_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 10 }).default("📋"),
    isDefault: boolean("is_default").default(false).notNull(),
    // Espacio de la lista de favoritos: null = particular (solo su autor);
    // un club = "Favoritos club", compartidas y editables por todos los
    // miembros activos del club. Ver lib/exercises/lists.ts.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("exercise_lists_user_id_idx").on(t.userId),
    index("exercise_lists_club_id_idx").on(t.clubId),
  ]
);

// Exercise list items (exercises in a list)
export const exerciseListItems = pgTable(
  "exercise_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .references(() => exerciseLists.id, { onDelete: "cascade" })
      .notNull(),
    exerciseId: uuid("exercise_id")
      .references(() => exercises.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("exercise_list_items_list_exercise_uniq").on(
      t.listId,
      t.exerciseId
    ),
    index("exercise_list_items_list_id_idx").on(t.listId),
    index("exercise_list_items_exercise_id_idx").on(t.exerciseId),
  ]
);

// Exercise drafts (persisted per user)
export const exerciseDrafts = pgTable(
  "exercise_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("exercise_drafts_user_updated_at_idx").on(t.userId, t.updatedAt),
  ]
);

// Session drafts (persisted per user)
export const sessionDrafts = pgTable(
  "session_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("session_drafts_user_updated_at_idx").on(t.userId, t.updatedAt)]
);

// Session templates (marketplace — no scheduledAt, no students)
export const sessionTemplates = pgTable(
  "session_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    objective: text("objective"),
    durationMinutes: integer("duration_minutes").notNull(),
    intensity: integer("intensity"),
    tags: json("tags").$type<string[]>(),
    location: varchar("location", { length: 50 }),
    adoptionsCount: integer("adoptions_count").default(0).notNull(),
    sport: sportEnum("sport").default("tenis").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("session_templates_author_id_idx").on(t.authorId),
    index("session_templates_created_at_idx").on(t.createdAt),
    index("session_templates_adoptions_count_idx").on(t.adoptionsCount),
    index("session_templates_sport_idx").on(t.sport),
  ]
);

// Session template exercises
export const sessionTemplateExercises = pgTable(
  "session_template_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .references(() => sessionTemplates.id, { onDelete: "cascade" })
      .notNull(),
    exerciseId: uuid("exercise_id")
      .references(() => exercises.id, { onDelete: "cascade" })
      .notNull(),
    orderIndex: integer("order_index").notNull(),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    phase: trainingPhaseEnum("phase"),
    intensity: integer("intensity"),
  },
  (t) => [
    uniqueIndex("session_template_exercises_template_order_uniq").on(
      t.templateId,
      t.orderIndex
    ),
    index("session_template_exercises_template_id_idx").on(t.templateId),
    index("session_template_exercises_exercise_id_idx").on(t.exerciseId),
  ]
);

// Session template adoptions (audit)
export const sessionTemplateAdoptions = pgTable(
  "session_template_adoptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .references(() => sessionTemplates.id, { onDelete: "cascade" })
      .notNull(),
    coachId: uuid("coach_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("session_template_adoptions_template_session_uniq").on(
      t.templateId,
      t.sessionId
    ),
    index("session_template_adoptions_template_id_idx").on(t.templateId),
    index("session_template_adoptions_coach_id_idx").on(t.coachId),
  ]
);

// =====================================================================
// CLASSES (PMV 260506) — biblioteca de plantillas reutilizables
// Una "class" es una plantilla con 3 bloques (inicial / principal / final).
// Cuando se "agenda" a un grupo en una fecha/lugar, se convierte en una
// session.
// =====================================================================
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    duracionMinutes: integer("duracion_minutes").notNull(),
    alumnosTipo: varchar("alumnos_tipo", { length: 16 }), // individual|grupal
    objetivos: text("objetivos"),
    material: text("material"),
    videoUrl: text("video_url"),
    aspectosImportantes: text("aspectos_importantes"),
    numAlumnos: integer("num_alumnos"),
    nivel: varchar("nivel", { length: 32 }),
    aspectoJuego: varchar("aspecto_juego", { length: 16 }),
    niveles: jsonb("niveles").$type<string[]>(),
    aspectosJuego: jsonb("aspectos_juego").$type<string[]>(),
    golpes: json("golpes").$type<string[]>(),
    // Etiquetas libres (las mismas que en las sesiones).
    tags: jsonb("tags").$type<string[]>(),
    // Animación de la clase activada (p. ej. al guardarla desde una sesión
    // que la tenía). Se genera siempre a partir de sus bloques actuales.
    animationEnabled: boolean("animation_enabled").default(false).notNull(),
    isLibrary: boolean("is_library").default(false).notNull(),
    // Autoría de la clase: "ten_planner" | "libre" | el id de un
    // monitor/academia dado de alta (p. ej. "academia_christian_larsen").
    // Mismo campo/semántica que exercises.autoria (ver comentario allí).
    autoria: varchar("autoria", { length: 64 }).default("libre"),
    // null = clase particular. Se asigna cuando el monitor crea esta clase
    // en nombre de un club al que está vinculado.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    // Deporte de la clase (biblioteca de plantillas por deporte).
    sport: sportEnum("sport").default("tenis").notNull(),
    // "published" | "draft". Un borrador solo lo ve quien lo creó (aún se
    // está configurando); ver lib/classes/visibility.ts.
    status: varchar("status", { length: 16 }).default("published").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("classes_created_by_idx").on(t.createdBy),
    index("classes_is_library_idx").on(t.isLibrary),
    index("classes_nivel_idx").on(t.nivel),
    index("classes_name_idx").on(t.name),
    index("classes_niveles_gin_idx").using("gin", t.niveles),
    index("classes_aspectos_juego_gin_idx").using("gin", t.aspectosJuego),
    index("classes_autoria_idx").on(t.autoria),
    index("classes_club_id_idx").on(t.clubId),
    index("classes_sport_idx").on(t.sport),
    index("classes_status_idx").on(t.status),
  ]
);

export const classBlocks = pgTable(
  "class_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .references(() => classes.id, { onDelete: "cascade" })
      .notNull(),
    orderIndex: integer("order_index").notNull(), // 1=inicial, 2=principal, 3=final
    title: varchar("title", { length: 120 }),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("class_blocks_class_order_uniq").on(t.classId, t.orderIndex),
    index("class_blocks_class_id_idx").on(t.classId),
  ]
);

export const classBlockExercises = pgTable(
  "class_block_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id")
      .references(() => classBlocks.id, { onDelete: "cascade" })
      .notNull(),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    freeText: text("free_text"), // si exerciseId es null, contenido manual
    // Título corto para items de texto libre (kind="text"), mostrado en
    // negrita igual que el nombre de un ejercicio de biblioteca. Opcional:
    // una anotación o actividad libre puede no llevar título.
    title: varchar("title", { length: 120 }),
    orderIndex: integer("order_index").notNull(),
    durationMinutes: integer("duration_minutes"),
    // Notas del monitor sobre este elemento (las mismas que en la sesión).
    notes: text("notes"),
    // "exercise"|"text"|"warmup"|"stations"; null = legacy (infer from
    // exerciseId/freeText).
    kind: varchar("kind", { length: 16 }),
    // Sub-items for kind="stations" (2-10 estaciones); see lib/block-items.ts.
    stations: jsonb("stations").$type<StationItemJson[]>(),
    // Aspecto del juego (tecnica|tactica|fisico|mental) para items de texto
    // libre sin ejercicio de biblioteca asociado: permite que las
    // estadísticas de la sesión cuenten su tiempo aunque no se haya creado
    // una ficha completa. Null para ejercicios de biblioteca (su aspecto
    // sale de exercises.aspecto_juego) y para items sin clasificar.
    aspectoJuego: varchar("aspecto_juego", { length: 16 }),
  },
  (t) => [
    index("class_block_exercises_block_id_idx").on(t.blockId),
    index("class_block_exercises_block_order_idx").on(t.blockId, t.orderIndex),
    index("class_block_exercises_exercise_id_idx").on(t.exerciseId),
  ]
);

export const classFavorites = pgTable(
  "class_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    classId: uuid("class_id")
      .references(() => classes.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("class_favorites_user_class_uniq").on(t.userId, t.classId),
    index("class_favorites_user_id_idx").on(t.userId),
  ]
);

export const classLists = pgTable(
  "class_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    emoji: varchar("emoji", { length: 10 }).default("CL"),
    isDefault: boolean("is_default").default(false).notNull(),
    // Espacio de la lista ("Mis listas"): null = espacio particular (solo la
    // ve su autor); un club = compartida con los miembros activos de ese
    // club mientras trabajan en su modo. Ver sharedWithClubCondition.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    // Lista pública de la biblioteca (p. ej. "Lista clases bola roja"):
    // solo un admin puede marcarla. Cualquiera puede verla y copiarla a su
    // espacio desde la Biblioteca.
    isPublic: boolean("is_public").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("class_lists_user_id_idx").on(t.userId),
    index("class_lists_club_id_idx").on(t.clubId),
    index("class_lists_is_public_idx").on(t.isPublic),
  ]
);

export const classListItems = pgTable(
  "class_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .references(() => classLists.id, { onDelete: "cascade" })
      .notNull(),
    classId: uuid("class_id")
      .references(() => classes.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("class_list_items_list_class_uniq").on(t.listId, t.classId),
    index("class_list_items_list_id_idx").on(t.listId),
    index("class_list_items_class_id_idx").on(t.classId),
  ]
);

export const classDrafts = pgTable(
  "class_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("class_drafts_user_updated_at_idx").on(t.userId, t.updatedAt)]
);

// Calendar events (free-form items in the calendar, distinct from sessions)
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    // null = particular event. Set when the coach creates this on behalf
    // of a club they're linked to.
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("calendar_events_user_id_idx").on(t.userId),
    index("calendar_events_start_at_idx").on(t.startAt),
    index("calendar_events_user_start_at_idx").on(t.userId, t.startAt),
    index("calendar_events_club_id_idx").on(t.clubId),
  ]
);

// Festivos del calendario (rango de fechas sin hora). Los crea el club o un
// monitor. groupId null = todo el espacio (club o particular); con groupId,
// solo ese grupo. Una sesión que cae en festivo se marca "no se imparte" en
// la vista, sin borrarla.
export const calendarHolidays = pgTable(
  "calendar_holidays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("calendar_holidays_user_id_idx").on(t.userId),
    index("calendar_holidays_club_dates_idx").on(t.clubId, t.startDate),
    index("calendar_holidays_group_id_idx").on(t.groupId),
    check("calendar_holidays_range_chk", sql`${t.endDate} >= ${t.startDate}`),
  ]
);

// Resources ("Mis recursos") — enlaces, documentos e imágenes de utilidad
// para el monitor, organizados en Todos / Favoritos.
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    url: text("url"),
    documentUrl: text("document_url"),
    documentName: varchar("document_name", { length: 255 }),
    imageUrl: text("image_url"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("resources_user_id_idx").on(t.userId),
    index("resources_user_favorite_idx").on(t.userId, t.isFavorite),
    index("resources_user_created_at_idx").on(t.userId, t.createdAt),
  ]
);

// Dr. Planner chat history
export const drPlannerChats = pgTable(
  "dr_planner_chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 })
      .notNull()
      .default("Nueva conversación"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("dr_planner_chats_user_id_idx").on(t.userId),
    index("dr_planner_chats_updated_at_idx").on(t.updatedAt),
    index("dr_planner_chats_user_updated_at_idx").on(t.userId, t.updatedAt),
  ]
);

// Dr. Planner messages (normalized from drPlannerChats.messages json blob)
export const drPlannerMessages = pgTable(
  "dr_planner_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
      .references(() => drPlannerChats.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    parts: json("parts").$type<Record<string, unknown>[]>().notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("dr_planner_messages_chat_order_idx").on(t.chatId, t.orderIndex),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  exercises: many(exercises),
  coachedStudents: many(students),
  groups: many(groups),
  classLists: many(classLists),
  calendarEvents: many(calendarEvents),
  resources: many(resources),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  user: one(users, {
    fields: [resources.userId],
    references: [users.id],
  }),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [exercises.createdBy],
    references: [users.id],
  }),
  sessionExercises: many(sessionExercises),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  sourceClass: one(classes, {
    fields: [sessions.sourceClassId],
    references: [classes.id],
  }),
  sessionExercises: many(sessionExercises),
  sessionStudents: many(sessionStudents),
  blocks: many(sessionBlocks),
}));

export const sessionExercisesRelations = relations(
  sessionExercises,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionExercises.sessionId],
      references: [sessions.id],
    }),
    exercise: one(exercises, {
      fields: [sessionExercises.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const sessionBlocksRelations = relations(
  sessionBlocks,
  ({ one, many }) => ({
    session: one(sessions, {
      fields: [sessionBlocks.sessionId],
      references: [sessions.id],
    }),
    items: many(sessionBlockItems),
  })
);

export const sessionBlockItemsRelations = relations(
  sessionBlockItems,
  ({ one }) => ({
    block: one(sessionBlocks, {
      fields: [sessionBlockItems.blockId],
      references: [sessionBlocks.id],
    }),
    exercise: one(exercises, {
      fields: [sessionBlockItems.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const studentsRelations = relations(students, ({ one, many }) => ({
  coach: one(users, {
    fields: [students.coachId],
    references: [users.id],
  }),
  sessionStudents: many(sessionStudents),
  groupStudents: many(groupStudents),
}));

export const sessionStudentsRelations = relations(
  sessionStudents,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionStudents.sessionId],
      references: [sessions.id],
    }),
    student: one(students, {
      fields: [sessionStudents.studentId],
      references: [students.id],
    }),
  })
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
  coach: one(users, { fields: [groups.coachId], references: [users.id] }),
  groupStudents: many(groupStudents),
}));

export const groupStudentsRelations = relations(groupStudents, ({ one }) => ({
  group: one(groups, {
    fields: [groupStudents.groupId],
    references: [groups.id],
  }),
  student: one(students, {
    fields: [groupStudents.studentId],
    references: [students.id],
  }),
}));

export const drPlannerChatsRelations = relations(
  drPlannerChats,
  ({ many }) => ({
    messages: many(drPlannerMessages),
  })
);

export const drPlannerMessagesRelations = relations(
  drPlannerMessages,
  ({ one }) => ({
    chat: one(drPlannerChats, {
      fields: [drPlannerMessages.chatId],
      references: [drPlannerChats.id],
    }),
  })
);

export const sessionTemplatesRelations = relations(
  sessionTemplates,
  ({ one, many }) => ({
    author: one(users, {
      fields: [sessionTemplates.authorId],
      references: [users.id],
    }),
    templateExercises: many(sessionTemplateExercises),
    adoptions: many(sessionTemplateAdoptions),
  })
);

export const sessionTemplateExercisesRelations = relations(
  sessionTemplateExercises,
  ({ one }) => ({
    template: one(sessionTemplates, {
      fields: [sessionTemplateExercises.templateId],
      references: [sessionTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [sessionTemplateExercises.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const sessionTemplateAdoptionsRelations = relations(
  sessionTemplateAdoptions,
  ({ one }) => ({
    template: one(sessionTemplates, {
      fields: [sessionTemplateAdoptions.templateId],
      references: [sessionTemplates.id],
    }),
    coach: one(users, {
      fields: [sessionTemplateAdoptions.coachId],
      references: [users.id],
    }),
    session: one(sessions, {
      fields: [sessionTemplateAdoptions.sessionId],
      references: [sessions.id],
    }),
  })
);

export const exerciseDraftsRelations = relations(exerciseDrafts, ({ one }) => ({
  user: one(users, {
    fields: [exerciseDrafts.userId],
    references: [users.id],
  }),
}));

export const sessionDraftsRelations = relations(sessionDrafts, ({ one }) => ({
  user: one(users, {
    fields: [sessionDrafts.userId],
    references: [users.id],
  }),
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  coach: one(users, { fields: [places.coachId], references: [users.id] }),
  sessions: many(sessions),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [classes.createdBy],
    references: [users.id],
  }),
  blocks: many(classBlocks),
  favorites: many(classFavorites),
}));

export const classBlocksRelations = relations(classBlocks, ({ one, many }) => ({
  class: one(classes, {
    fields: [classBlocks.classId],
    references: [classes.id],
  }),
  blockExercises: many(classBlockExercises),
}));

export const classBlockExercisesRelations = relations(
  classBlockExercises,
  ({ one }) => ({
    block: one(classBlocks, {
      fields: [classBlockExercises.blockId],
      references: [classBlocks.id],
    }),
    exercise: one(exercises, {
      fields: [classBlockExercises.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const classFavoritesRelations = relations(classFavorites, ({ one }) => ({
  user: one(users, {
    fields: [classFavorites.userId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [classFavorites.classId],
    references: [classes.id],
  }),
}));

export const classListsRelations = relations(classLists, ({ one, many }) => ({
  user: one(users, {
    fields: [classLists.userId],
    references: [users.id],
  }),
  items: many(classListItems),
}));

export const classListItemsRelations = relations(classListItems, ({ one }) => ({
  list: one(classLists, {
    fields: [classListItems.listId],
    references: [classLists.id],
  }),
  class: one(classes, {
    fields: [classListItems.classId],
    references: [classes.id],
  }),
}));

export const classDraftsRelations = relations(classDrafts, ({ one }) => ({
  user: one(users, { fields: [classDrafts.userId], references: [users.id] }),
}));

// Landing page editable content (admin-managed copy)
export const landingContent = pgTable("landing_content", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: json("value").$type<unknown>().notNull(),
  type: varchar("type", { length: 20 }).notNull().default("string"),
  label: varchar("label", { length: 200 }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

// Admin-managed platform settings and feature flags.
export const appSettings = pgTable(
  "app_settings",
  {
    key: varchar("key", { length: 120 }).primaryKey(),
    value: json("value").$type<unknown>().notNull(),
    type: varchar("type", { length: 20 }).notNull().default("boolean"),
    label: varchar("label", { length: 200 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 80 }).notNull().default("general"),
    isPublic: boolean("is_public").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("app_settings_category_idx").on(t.category),
    index("app_settings_public_idx").on(t.isPublic),
  ]
);

// Semantic search index for AI retrieval over sessions and exercises.
export const aiDocumentEmbeddings = pgTable(
  "ai_document_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    source: aiEmbeddingSourceEnum("source").notNull(),
    sourceId: uuid("source_id").notNull(),
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    metadata: json("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    embeddedAt: timestamp("embedded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ai_doc_embeddings_owner_source_idx").on(t.ownerId, t.source),
    index("ai_doc_embeddings_source_id_idx").on(t.source, t.sourceId),
    index("ai_doc_embeddings_hash_idx").on(t.contentHash),
  ]
);

// AI usage ledger for admin cost and token analytics.
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    chatId: uuid("chat_id").references(() => drPlannerChats.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 40 })
      .notNull()
      .default("anthropic"),
    model: varchar("model", { length: 120 }).notNull(),
    operation: varchar("operation", { length: 80 })
      .notNull()
      .default("dr_planner_chat"),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    cacheReadTokens: integer("cache_read_tokens").default(0).notNull(),
    cacheWriteTokens: integer("cache_write_tokens").default(0).notNull(),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 6,
    })
      .default("0")
      .notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    finishReason: varchar("finish_reason", { length: 80 }),
    requestId: varchar("request_id", { length: 160 }),
    metadata: json("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ai_usage_events_user_created_idx").on(t.userId, t.createdAt),
    index("ai_usage_events_model_created_idx").on(t.model, t.createdAt),
    index("ai_usage_events_created_at_idx").on(t.createdAt),
  ]
);

// Admin controls for limiting individual AI users.
export const aiUserRestrictions = pgTable(
  "ai_user_restrictions",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    isRestricted: boolean("is_restricted").default(false).notNull(),
    customMessage: text("custom_message"),
    dailyTokenLimit: integer("daily_token_limit"),
    monthlyTokenLimit: integer("monthly_token_limit"),
    modelOverride: varchar("model_override", { length: 120 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("ai_user_restrictions_restricted_idx").on(t.isRestricted),
    index("ai_user_restrictions_model_idx").on(t.modelOverride),
  ]
);

// Internal task tracker for David & Darío — not visible to other admins or users.
export const devTasks = pgTable(
  "dev_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    assignedTo: devTaskAssigneeEnum("assigned_to").notNull(),
    status: devTaskStatusEnum("status").default("pendiente").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    observaciones: text("observaciones"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("dev_tasks_status_idx").on(t.status),
    index("dev_tasks_assigned_to_idx").on(t.assignedTo),
    index("dev_tasks_created_at_idx").on(t.createdAt),
  ]
);

// Clubs — an organization account that can link several coaches' spaces
// under shared management. The registering user becomes the `owner` member.
export const clubs = pgTable(
  "clubs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Informational only for now — no seat billing/enforcement.
    plannedCoachSeats: integer("planned_coach_seats"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("clubs_owner_id_idx").on(t.ownerId)]
);

// Club membership — one row per (club, user). The owner also gets a row
// here (role "owner") so membership checks don't need a special case.
export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // La vinculación monitor↔club es por (club, usuario, deporte): un
    // mismo monitor puede estar dado de alta en el Club X para tenis y
    // pádel, pero no para pickleball, con una fila por combinación.
    sport: sportEnum("sport").default("tenis").notNull(),
    role: clubMemberRoleEnum("role").notNull(),
    status: clubMemberStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("club_members_club_user_sport_uniq").on(
      t.clubId,
      t.userId,
      t.sport
    ),
    index("club_members_club_id_idx").on(t.clubId),
    index("club_members_user_id_idx").on(t.userId),
    index("club_members_sport_idx").on(t.sport),
  ]
);

// Pending invitations to join a club as a coach, by email — works even if
// the invited address has no TenPlanner account yet.
export const clubInvites = pgTable(
  "club_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    status: clubInviteStatusEnum("status").notNull().default("pending"),
    // El deporte para el que se invita al monitor — una invitación es para
    // un deporte; el mismo email puede tener invitaciones pendientes
    // distintas para deportes distintos del mismo club.
    sport: sportEnum("sport").default("tenis").notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    index("club_invites_club_id_idx").on(t.clubId),
    index("club_invites_email_idx").on(t.email),
    index("club_invites_sport_idx").on(t.sport),
  ]
);

export const clubsRelations = relations(clubs, ({ many }) => ({
  members: many(clubMembers),
  invites: many(clubInvites),
}));

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, { fields: [clubMembers.clubId], references: [clubs.id] }),
  user: one(users, { fields: [clubMembers.userId], references: [users.id] }),
}));

export const clubInvitesRelations = relations(clubInvites, ({ one }) => ({
  club: one(clubs, { fields: [clubInvites.clubId], references: [clubs.id] }),
}));

// ─── Avisos club → familias (fase 1 de la comunicación del club) ──────────────
// Las políticas RLS, funciones y triggers viven en la migración SQL
// 0054_avisos_familias.sql; aquí solo el esquema de tablas.

// Tutores / familias de un alumno. Hoy los alumnos no tienen cuenta: cada
// tutor activa la suya con un enlace (inviteToken) y a partir de ahí
// userId = su usuario. Un alumno adulto puede ser su propio "tutor".
export const studentGuardians = pgTable(
  "student_guardians",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    // "madre" | "padre" | "tutor_legal" | "alumno"
    relationship: varchar("relationship", { length: 30 }),
    inviteToken: varchar("invite_token", { length: 128 }).unique(),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    // Consentimiento RGPD para recibir avisos del club
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
    consentVersion: varchar("consent_version", { length: 20 }),
    // Baja: deja de ver avisos y respuestas
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("student_guardians_student_id_idx").on(t.studentId),
    index("student_guardians_user_id_idx").on(t.userId),
  ]
);

// A quién va un mensaje del club:
// - "club": familias de todos los alumnos del club
// - "group": familias de un grupo (groupId)
// - "student": tutores de un alumno, o el propio alumno si es mayor (studentId)
// - "coaches": todos los monitores del club (del deporte `sport` si se indica)
// - "coach": un monitor concreto (recipientUserId)
export const announcementAudienceEnum = pgEnum("announcement_audience", [
  "club",
  "group",
  "student",
  "coaches",
  "coach",
]);

// Mensajes del club. Quién puede enviar y quién puede leer cada tipo lo
// deciden las políticas RLS de las migraciones 0054 y 0055.
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    audience: announcementAudienceEnum("audience").default("group").notNull(),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "cascade",
    }),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    // Solo para audience "coaches": limita a los monitores de ese deporte
    sport: sportEnum("sport"),
    // Opcional: liga el aviso a una sesión de ese grupo
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 140 }).notNull(),
    body: text("body").notNull(),
    allowReplies: boolean("allow_replies").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    // Borrado lógico
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("announcements_club_created_idx").on(t.clubId, t.createdAt),
    index("announcements_group_created_idx").on(t.groupId, t.createdAt),
    index("announcements_student_created_idx").on(t.studentId, t.createdAt),
    index("announcements_recipient_created_idx").on(
      t.recipientUserId,
      t.createdAt
    ),
    check("announcements_body_len", sql`char_length(${t.body}) <= 4000`),
    check(
      "announcements_audience_target",
      sql`(${t.audience} = 'club' and ${t.groupId} is null and ${t.studentId} is null and ${t.recipientUserId} is null)
       or (${t.audience} = 'group' and ${t.groupId} is not null and ${t.studentId} is null and ${t.recipientUserId} is null)
       or (${t.audience} = 'student' and ${t.studentId} is not null and ${t.groupId} is null and ${t.recipientUserId} is null)
       or (${t.audience} = 'coaches' and ${t.groupId} is null and ${t.studentId} is null and ${t.recipientUserId} is null)
       or (${t.audience} = 'coach' and ${t.recipientUserId} is not null and ${t.groupId} is null and ${t.studentId} is null)`
    ),
  ]
);

// Respuestas: un hilo privado por familia dentro de cada aviso
// (threadGuardianId). Las demás familias nunca lo ven.
export const announcementReplies = pgTable(
  "announcement_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    announcementId: uuid("announcement_id")
      .references(() => announcements.id, { onDelete: "cascade" })
      .notNull(),
    threadGuardianId: uuid("thread_guardian_id")
      .references(() => studentGuardians.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("announcement_replies_thread_idx").on(
      t.announcementId,
      t.threadGuardianId,
      t.createdAt
    ),
    check("announcement_replies_body_len", sql`char_length(${t.body}) <= 2000`),
  ]
);

// Confirmaciones de lectura ("leído por 12 de 15")
export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: uuid("announcement_id")
      .references(() => announcements.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })]
);

export const studentGuardiansRelations = relations(
  studentGuardians,
  ({ one, many }) => ({
    student: one(students, {
      fields: [studentGuardians.studentId],
      references: [students.id],
    }),
    user: one(users, {
      fields: [studentGuardians.userId],
      references: [users.id],
    }),
    replies: many(announcementReplies),
  })
);

export const announcementsRelations = relations(
  announcements,
  ({ one, many }) => ({
    club: one(clubs, {
      fields: [announcements.clubId],
      references: [clubs.id],
    }),
    group: one(groups, {
      fields: [announcements.groupId],
      references: [groups.id],
    }),
    session: one(sessions, {
      fields: [announcements.sessionId],
      references: [sessions.id],
    }),
    author: one(users, {
      fields: [announcements.authorId],
      references: [users.id],
    }),
    replies: many(announcementReplies),
    reads: many(announcementReads),
  })
);

export const announcementRepliesRelations = relations(
  announcementReplies,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementReplies.announcementId],
      references: [announcements.id],
    }),
    thread: one(studentGuardians, {
      fields: [announcementReplies.threadGuardianId],
      references: [studentGuardians.id],
    }),
    author: one(users, {
      fields: [announcementReplies.authorId],
      references: [users.id],
    }),
  })
);

export const announcementReadsRelations = relations(
  announcementReads,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementReads.announcementId],
      references: [announcements.id],
    }),
    user: one(users, {
      fields: [announcementReads.userId],
      references: [users.id],
    }),
  })
);

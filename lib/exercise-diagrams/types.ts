/**
 * Esquemas de pista de los ejercicios.
 *
 * Un esquema son solo datos (JSON): la app los dibuja en pantalla y en el PDF.
 * Coordenadas: [x, y] en el rango 0–100 sobre la zona de juego. Se admiten
 * valores fuera de 0–100 (p. ej. -6 o 106) para colocar cosas detrás de las
 * líneas o junto a la pista.
 *
 *  - court "tenis": pista completa vista desde arriba. x: 0 = lateral izquierdo
 *    (de dobles), 100 = lateral derecho. y: 0 = línea de fondo lejana,
 *    50 = red, 100 = línea de fondo cercana. Líneas de individuales en
 *    x = 12.5 y 87.5; líneas de saque en y = 23 y 77.
 *  - court "medio": media pista. y: 0 = red (arriba), 100 = línea de fondo.
 *    Línea de saque en y = 54.
 *  - court "mini": pista reducida (roja/naranja) completa. y: 0 = fondo lejano,
 *    50 = red, 100 = fondo cercano. Sin líneas de saque.
 *  - court "libre": zona cuadrada sin líneas, para juegos con conos y aros.
 */
export type Pt = [number, number];

export type CourtKind = "tenis" | "medio" | "mini" | "libre";

export type DiagramElement =
  /** Jugador/alumno. role: alumno (azul), monitor (negro), rival (naranja). */
  | {
      t: "player";
      at: Pt;
      role?: "alumno" | "monitor" | "rival";
      /** Una o dos letras/números dentro del círculo (A, B, 1, 2…). */
      label?: string;
    }
  | { t: "ball"; at: Pt }
  /** Cesta o carro de bolas. */
  | { t: "basket"; at: Pt }
  | { t: "cone"; at: Pt }
  /** Aro en el suelo. */
  | { t: "hoop"; at: Pt }
  /** Escalera de coordinación entre dos extremos. */
  | { t: "ladder"; from: Pt; to: Pt }
  /** Zona sombreada (objetivo, cuadro, pasillo…). */
  | { t: "zone"; from: Pt; to: Pt; label?: string }
  /** Línea fija (marca en el suelo, cuerda). */
  | { t: "line"; from: Pt; to: Pt; dashed?: boolean }
  /** Desplazamiento de un jugador: línea continua con flecha. */
  | { t: "move"; points: Pt[] }
  /** Trayectoria de la pelota: línea discontinua con flecha. */
  | { t: "shot"; points: Pt[] }
  /** Texto corto sobre el esquema (máx. ~14 caracteres). */
  | { t: "text"; at: Pt; text: string };

/**
 * Coreografía opcional: guion de la animación paso a paso. Sin ella, la
 * animación se deduce de los elementos (cada flecha "shot" es un vuelo de la
 * pelota y cada "move" lo hace el jugador más cercano a su inicio). Con ella
 * el ejercicio se anima "currado": botes, trayectorias suaves, golpes y una
 * frase por paso.
 */
export type ChoreoStep = {
  /** Frase que se muestra mientras dura el paso (máx. ~80 caracteres). */
  text?: string;
  /** Duración en segundos; si falta se calcula por lo que recorre. */
  dur?: number;
  /** Desplazamientos; `who` = nº del jugador en orden de aparición (desde 0). */
  moves?: { who: number; path: Pt[] }[];
  /** Vuelo de la pelota; `bounces` = índices de `path` donde bota. */
  ball?: { path: Pt[]; bounces?: number[] };
  /** Jugador que golpea al empezar el paso (anillo de impacto). */
  swing?: number;
};

export type Choreo = { steps: ChoreoStep[] };

export type Diagram = {
  court: CourtKind;
  elements: DiagramElement[];
  choreo?: Choreo;
  /** Pie del esquema, una frase corta (máx. ~70 caracteres). */
  caption?: string;
};

export type DiagramMap = Record<string, Diagram>;

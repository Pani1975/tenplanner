import {
  ASPECTO_JUEGO_LABELS,
  AUTORIAS,
  CARACTER,
  FASES,
  NUEVOS_TIPOS_ACTIVIDAD,
  PELOTAS,
  SITUACION_JUEGO,
  TIPO_ACTIVIDAD_LABELS,
  TIPO_COMPETICION,
} from "@/lib/exercise-taxonomy";

// Opciones de los filtros de la biblioteca de ejercicios. Fuente única: la
// usan el panel de filtros y las cifras de la portada.

export type Option = { id: string; label: string; color?: string };

const FORMATOS: Option[] = [
  { id: "individual", label: "Individual" },
  { id: "parejas", label: "Parejas" },
  { id: "grupal", label: "Grupal" },
  { id: "multigrupo", label: "Multigrupo" },
];

const ASPECTOS: Option[] = [
  { id: "tecnica", label: "Técnica" },
  { id: "tactica", label: "Táctica" },
  { id: "mental", label: ASPECTO_JUEGO_LABELS.mental },
  { id: "fisico", label: ASPECTO_JUEGO_LABELS.fisico },
];

const PARAMETROS: Option[] = [
  { id: "altura", label: "Altura" },
  { id: "profundidad", label: "Profundidad" },
  { id: "velocidad", label: "Velocidad" },
  { id: "direccion", label: "Dirección" },
  { id: "efecto", label: "Efecto" },
];

const DURACION_RANGOS: Option[] = [
  { id: "1-5", label: "1-5 min" },
  { id: "5-10", label: "5-10 min" },
  { id: "10-15", label: "10-15 min" },
  { id: "15-20", label: "15-20 min" },
  { id: "+20", label: "+20 min" },
];

// Incluye los tipos antiguos para poder encontrar los ejercicios que aún no se
// han re-etiquetado. En el filtro se muestran sin marca de "antiguo".
const TIPOS_ACTIVIDAD: Option[] = NUEVOS_TIPOS_ACTIVIDAD.map((id) => ({
  id,
  label: TIPO_ACTIVIDAD_LABELS[id],
}));

const PELOTAS_COLOR: Option[] = PELOTAS.map((p) => ({ ...p }));

const GOLPES: Option[] = [
  { id: "derecha", label: "Derecha" },
  { id: "reves", label: "Revés" },
  { id: "saque", label: "Saque" },
  { id: "volea", label: "Volea" },
  { id: "remate", label: "Remate" },
  { id: "globo", label: "Globo" },
  { id: "dejada", label: "Dejada" },
  { id: "resto", label: "Resto" },
];

const EFECTOS: Option[] = [
  { id: "liftado", label: "Liftado" },
  { id: "cortado", label: "Cortado" },
  { id: "plano", label: "Plano" },
];

const UBICACIONES: Option[] = [
  { id: "pista", label: "Pista" },
  { id: "pared", label: "Pared" },
  { id: "playa", label: "Playa" },
  { id: "casa", label: "Casa" },
];

const JUGADORES: Option[] = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5", label: "5" },
  { id: "6", label: "6" },
  { id: "7", label: "+6" },
];


export type FilterDef = {
  // Nombre del parámetro en la URL.
  param: string;
  label: string;
  options: Option[];
  swatches?: boolean;
};

// Todos los filtros se muestran a la vez; los más usados van primero.
export const PRIMARY_FILTERS: FilterDef[] = [
  { param: "aspectoJuego", label: "Aspecto", options: ASPECTOS },
  {
    param: "tipoActividad",
    label: "Tipo de ejercicio",
    options: TIPOS_ACTIVIDAD,
  },
  { param: "duracionRango", label: "Duración", options: DURACION_RANGOS },
  { param: "formato", label: "Formato", options: FORMATOS },
  {
    param: "tipoPelota",
    label: "Pelota",
    options: PELOTAS_COLOR,
    swatches: true,
  },
  { param: "fase", label: "Fase", options: FASES.map((f) => ({ ...f })) },
];

export const SECONDARY_FILTERS: FilterDef[] = [
  { param: "parametro", label: "Parámetros", options: PARAMETROS },
  {
    param: "caracter",
    label: "Carácter",
    options: CARACTER.map((c) => ({ ...c })),
  },
  {
    param: "situacionJuego",
    label: "Situación del juego",
    options: SITUACION_JUEGO.map((s) => ({ ...s })),
  },
  {
    param: "tipoCompeticion",
    label: "Competición",
    options: TIPO_COMPETICION.map((c) => ({ ...c })),
  },
  { param: "numJugadores", label: "Jugadores", options: JUGADORES },
  { param: "location", label: "Lugar", options: UBICACIONES },
  {
    param: "autoria",
    label: "Autoría",
    options: AUTORIAS.map((a) => ({ ...a })),
  },
  { param: "golpe", label: "Golpes", options: GOLPES },
  { param: "efecto", label: "Efecto", options: EFECTOS },
];

// Los objetivos del catálogo se redactan en presente ("Golpea la pelota…"),
// porque describen lo que el alumno hace cuando lo ha conseguido. En los
// ejercicios y en las clases se escriben en infinitivo ("Golpear la pelota…"),
// porque son lo que se trabaja. Este módulo pasa un título del catálogo a
// infinitivo: convierte el verbo principal y los verbos coordinados con él
// ("Conoce y aplica…" → "Conocer y aplicar…"), mantiene la etiqueta del golpe
// ("Saque: lanza…" → "Saque: lanzar…") y no toca las oraciones subordinadas
// ("…cuando falla", "…que pasan la red").

/** Tercera persona del presente → infinitivo, para los verbos del catálogo. */
const VERBS: Record<string, string> = {
  abre: "abrir",
  acelera: "acelerar",
  acepta: "aceptar",
  actúa: "actuar",
  adapta: "adaptar",
  adopta: "adoptar",
  ajusta: "ajustar",
  alterna: "alternar",
  amortigua: "amortiguar",
  analiza: "analizar",
  anticipa: "anticipar",
  aplica: "aplicar",
  aprovecha: "aprovechar",
  aproxima: "aproximar",
  ataca: "atacar",
  aterriza: "aterrizar",
  atrapa: "atrapar",
  aumenta: "aumentar",
  busca: "buscar",
  calienta: "calentar",
  cambia: "cambiar",
  camina: "caminar",
  canta: "cantar",
  celebra: "celebrar",
  cierra: "cerrar",
  colabora: "colaborar",
  coloca: "colocar",
  combina: "combinar",
  compite: "competir",
  completa: "completar",
  comprende: "comprender",
  compromete: "comprometer",
  comunica: "comunicar",
  conoce: "conocer",
  consigue: "conseguir",
  consolida: "consolidar",
  construye: "construir",
  continúa: "continuar",
  contraataca: "contraatacar",
  contrarresta: "contrarrestar",
  controla: "controlar",
  coopera: "cooperar",
  coordina: "coordinar",
  corre: "correr",
  crea: "crear",
  cubre: "cubrir",
  cuenta: "contar",
  cuida: "cuidar",
  cumple: "cumplir",
  da: "dar",
  defiende: "defender",
  deja: "dejar",
  desarrolla: "desarrollar",
  desplaza: "desplazar",
  detecta: "detectar",
  devuelve: "devolver",
  diferencia: "diferenciar",
  dirige: "dirigir",
  disfruta: "disfrutar",
  disimula: "disimular",
  distingue: "distinguir",
  domina: "dominar",
  ejecuta: "ejecutar",
  elige: "elegir",
  empieza: "empezar",
  empuja: "empujar",
  encadena: "encadenar",
  entiende: "entender",
  entra: "entrar",
  envía: "enviar",
  escucha: "escuchar",
  estabiliza: "estabilizar",
  establece: "establecer",
  evalúa: "evaluar",
  evita: "evitar",
  explica: "explicar",
  explora: "explorar",
  felicita: "felicitar",
  fija: "fijar",
  finaliza: "finalizar",
  frena: "frenar",
  gana: "ganar",
  gestiona: "gestionar",
  golpea: "golpear",
  hace: "hacer",
  identifica: "identificar",
  impacta: "impactar",
  impulsa: "impulsar",
  inicia: "iniciar",
  integra: "integrar",
  introduce: "introducir",
  juega: "jugar",
  justifica: "justificar",
  lanza: "lanzar",
  lee: "leer",
  libera: "liberar",
  llega: "llegar",
  lleva: "llevar",
  maneja: "manejar",
  mantiene: "mantener",
  marca: "marcar",
  mejora: "mejorar",
  mete: "meter",
  motiva: "motivar",
  mueve: "mover",
  muestra: "mostrar",
  neutraliza: "neutralizar",
  nombra: "nombrar",
  obliga: "obligar",
  para: "parar",
  participa: "participar",
  pasa: "pasar",
  pelotea: "pelotear",
  pivota: "pivotar",
  pone: "poner",
  practica: "practicar",
  prepara: "preparar",
  produce: "producir",
  propone: "proponer",
  protege: "proteger",
  reacciona: "reaccionar",
  realiza: "realizar",
  recibe: "recibir",
  reconoce: "reconocer",
  recorta: "recortar",
  recupera: "recuperar",
  reduce: "reducir",
  regula: "regular",
  reintenta: "reintentar",
  remata: "rematar",
  respeta: "respetar",
  respira: "respirar",
  resta: "restar",
  resuelve: "resolver",
  revisa: "revisar",
  rinde: "rendir",
  sabe: "saber",
  saca: "sacar",
  sale: "salir",
  salta: "saltar",
  señala: "señalar",
  sigue: "seguir",
  sostiene: "sostener",
  sube: "subir",
  termina: "terminar",
  tiene: "tener",
  toca: "tocar",
  toma: "tomar",
  trabaja: "trabajar",
  transfiere: "transferir",
  trata: "tratar",
  usa: "usar",
  utiliza: "utilizar",
  va: "ir",
  valora: "valorar",
  varía: "variar",
  visualiza: "visualizar",
  volea: "volear",
  vuelve: "volver",
};

/**
 * Formas que también son sustantivos o preposiciones ("la volea", "para el
 * revés", "cuenta atrás"). Solo se convierten al principio del título o tras
 * un pronombre ("la para" → "pararla").
 */
const ONLY_AT_START = new Set(["volea", "para", "cuenta"]);

/** Palabras que abren una subordinada: lo que viene detrás no se toca. */
const SUBORDINATORS = new Set([
  "que",
  "cuando",
  "si",
  "donde",
  "mientras",
  "porque",
  "aunque",
  "como",
  "sin",
]);

const CLITICS = new Set(["se", "la", "lo", "le", "las", "los", "les"]);

/** Títulos sin verbo conjugado o que la regla general no resuelve bien. */
const OVERRIDES: Record<string, string> = {
  "Gestiona la frustración tras fallar (respira, reintenta)":
    "Gestionar la frustración tras fallar (respirar, reintentar)",
  "Cierra los espacios al rival: se desplaza hacia la pelota y tras el golpe cubre toda la pista":
    "Cerrar los espacios al rival: desplazarse hacia la pelota y, tras el golpe, cubrir toda la pista",
  "Volea alta: frontal en la derecha, lateral en el revés y apoyo del pie de atrás":
    "Volea alta: golpear de frente en la derecha y de lado en el revés, apoyando el pie de atrás",
  "Volea media: más velocidad de mano, direcciones cortas y abiertas y apoyo de la pierna adelantada":
    "Volea media: dar más velocidad de mano, buscar direcciones cortas y abiertas y apoyar la pierna adelantada",
  "Volea baja: apoyo del pie de delante, piernas flexionadas y tronco erguido":
    "Volea baja: apoyar el pie de delante con las piernas flexionadas y el tronco erguido",
  "Revés de ataque: plano y recto, golpeando a la altura del pecho con terminación recortada":
    "Revés de ataque: golpear plano y recto a la altura del pecho con terminación recortada",
  "Revés de construcción: profundo y dirigido, desde dentro de la pista":
    "Revés de construcción: jugarlo profundo y dirigido desde dentro de la pista",
  "Revés de defensa: con altura, peso y profundidad, sin caer hacia atrás":
    "Revés de defensa: jugarlo con altura, peso y profundidad, sin caer hacia atrás",
  "Resto ofensivo: split step hacia delante, armado recortado y posición abierta":
    "Resto ofensivo: hacer el split step hacia delante, recortar el armado y restar en posición abierta",
  "Resto defensivo: posición estable, armado alto y corto y muñeca firme":
    "Resto defensivo: restar con posición estable, armado alto y corto y muñeca firme",
  "Revés a dos manos: empuñadura continental en la mano dominante y este en la otra, que dirige el golpe":
    "Revés a dos manos: usar la empuñadura continental en la mano dominante y la este en la otra, que dirige el golpe",
  "Desde la línea de saque, saca golpeando con el centro de la raqueta, terminando el golpe y dirigiendo la pelota al cuadro de saque correspondiente":
    "Desde la línea de saque, sacar golpeando con el centro de la raqueta, terminando el golpe y dirigiendo la pelota al cuadro de saque correspondiente",
  "Derecha: golpea con apoyo semiabierto como base y usa el abierto y el cerrado según la pelota":
    "Derecha: golpear con apoyo semiabierto como base y usar el abierto y el cerrado según la pelota",
  "Practica en dobles las transiciones y el juego de red: suben juntos y cubren el centro":
    "Practicar en dobles las transiciones y el juego de red: subir juntos y cubrir el centro",
  "Revés cortado: empuñadura continental, armado alto y mano por encima del codo":
    "Revés cortado: usar la empuñadura continental, armar alto y llevar la mano por encima del codo",
};

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Pasa a infinitivo un objetivo redactado en presente. Si no reconoce ningún
 * verbo, devuelve el texto tal cual.
 */
export function objectiveToInfinitive(title: string): string {
  const text = title.trim();
  if (OVERRIDES[text]) return OVERRIDES[text];

  // Palabras y separadores, conservando el texto original.
  const tokens = text.split(/(\s+|[,:;()])/).filter((t) => t !== "");
  const words: number[] = [];
  tokens.forEach((t, i) => {
    if (!/^(\s+|[,:;()])$/.test(t)) words.push(i);
  });

  // Lo que va antes de los dos puntos es una etiqueta ("Remate con bote:")
  // cuando detrás empieza un verbo y la etiqueta no empieza por uno.
  const colon = text.indexOf(": ");
  let headIsLabel = false;
  if (colon > 0) {
    const head = text.slice(0, colon).trim().split(/\s+/)[0].toLowerCase();
    const tail = text
      .slice(colon + 2)
      .trim()
      .split(/\s+/);
    const t0 = (tail[0] ?? "").toLowerCase();
    const t1 = (tail[1] ?? "").toLowerCase();
    const tailVerb = !!VERBS[t0] || (CLITICS.has(t0) && !!VERBS[t1]);
    headIsLabel = tailVerb && (!VERBS[head] || ONLY_AT_START.has(head));
  }

  const out = [...tokens];
  let converted = false; // ya hemos pasado a infinitivo el verbo principal
  let stopped = false; // estamos dentro de una subordinada
  let depth = 0; // paréntesis
  let stopWord = ""; // palabra que abrió la subordinada

  const prevSep = (ti: number) => {
    for (let j = ti - 1; j >= 0; j--) {
      if (/^\s+$/.test(tokens[j])) continue;
      return tokens[j];
    }
    return null;
  };
  const nextSep = (ti: number) => {
    for (let j = ti + 1; j < tokens.length; j++) {
      if (/^\s+$/.test(tokens[j])) continue;
      return tokens[j];
    }
    return null;
  };

  for (let k = 0; k < words.length; k++) {
    const ti = words[k];
    const raw = tokens[ti];
    const w = raw.toLowerCase();

    // Paréntesis y subordinadas: se recorren sin tocar.
    for (let j = words[k - 1] ?? -1; j < ti; j++) {
      if (tokens[j] === "(") depth++;
      if (tokens[j] === ")") depth = Math.max(0, depth - 1);
      if (tokens[j] === ":") stopped = false;
      // "sin perder el control, y da…": la negación acaba en la coma.
      if (tokens[j] === "," && stopWord === "sin") stopped = false;
    }
    if (depth > 0) continue;
    if (SUBORDINATORS.has(w)) {
      stopped = true;
      stopWord = w;
      continue;
    }
    if (stopped) continue;

    const prev = prevSep(ti);
    const isFirst = k === 0;
    const afterColon = prev === ":";
    const afterCoord =
      prev === "," ||
      (prev !== null && ["y", "e", "o", "u"].includes(prev.toLowerCase()));
    const clauseStart = isFirst || afterColon || (converted && afterCoord);
    if (!clauseStart) continue;

    // Etiqueta del golpe: "Saque: …", "Volea: …", "Volea liftada: …".
    if (isFirst && (nextSep(ti) === ":" || headIsLabel)) continue;

    // Pronombre delante del verbo: "se coloca", "la deja", "le felicita".
    if (CLITICS.has(w) && k + 1 < words.length) {
      const vi = words[k + 1];
      const verb = tokens[vi].toLowerCase();
      const inf = VERBS[verb];
      if (inf) {
        let res = inf + w;
        if (isFirst) res = capitalize(res);
        out[ti] = res;
        // Quita el verbo y el espacio que lo separaba del pronombre.
        out[vi] = "";
        for (let j = ti + 1; j < vi; j++) out[j] = "";
        converted = true;
        k++;
        continue;
      }
    }

    const inf = VERBS[w];
    if (!inf) continue;
    if (ONLY_AT_START.has(w) && !isFirst && !afterColon) continue;
    out[ti] =
      isFirst || raw[0] === raw[0].toUpperCase() ? capitalize(inf) : inf;
    converted = true;
  }

  return out.join("");
}

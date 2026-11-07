/**
 * Datos editables dentro de la propia imagen PNG.
 *
 * La pizarra guarda los trazos en un bloque de texto (tEXt) del PNG, así el
 * dibujo es un solo archivo: no depende de que el almacenamiento admita otros
 * tipos de archivo y la imagen sigue viéndose igual en cualquier sitio.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Devuelve una copia del PNG con `text` guardado bajo `keyword`. */
export function embedPngText(
  png: Uint8Array,
  keyword: string,
  text: string
): Uint8Array<ArrayBuffer> {
  if (!isPng(png)) throw new Error("No es un PNG válido");

  // Busca el bloque IEND (el último) para insertar el nuestro antes.
  let offset = 8;
  let iendAt = -1;
  while (offset + 8 <= png.length) {
    const length = new DataView(
      png.buffer,
      png.byteOffset + offset,
      4
    ).getUint32(0);
    if (ascii(png, offset + 4, offset + 8) === "IEND") {
      iendAt = offset;
      break;
    }
    offset += 12 + length;
  }
  if (iendAt < 0) throw new Error("PNG sin bloque final");

  const data = new TextEncoder().encode(`${keyword}\0${toBase64(text)}`);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4); // "tEXt"
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));

  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iendAt), 0);
  out.set(chunk, iendAt);
  out.set(png.subarray(iendAt), iendAt + chunk.length);
  return out;
}

/** Lee el texto guardado bajo `keyword`, o null si el PNG no lo tiene. */
export function readPngText(png: Uint8Array, keyword: string): string | null {
  if (!isPng(png)) return null;
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = new DataView(
      png.buffer,
      png.byteOffset + offset,
      4
    ).getUint32(0);
    const type = ascii(png, offset + 4, offset + 8);
    if (type === "tEXt") {
      const body = png.subarray(offset + 8, offset + 8 + length);
      const zero = body.indexOf(0);
      if (zero > 0 && ascii(body, 0, zero) === keyword) {
        try {
          return fromBase64(ascii(body, zero + 1, body.length));
        } catch {
          return null;
        }
      }
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return null;
}

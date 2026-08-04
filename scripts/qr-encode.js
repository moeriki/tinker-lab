// A QR Code encoder, byte mode, versions 1-10, all four error-correction levels.
//
// WHY THIS IS HERE INSTEAD OF `npm i qrcode`
// ------------------------------------------
// The app has zero runtime dependencies and the Dockerfile fails the build if `dependencies` ever
// stops being empty (see the guard in Dockerfile). A QR library would be a *dev* dependency, so it
// would technically slip past that guard -- and that is exactly why it is the wrong answer here.
// The codes are printed on the day of the party. `pnpm install` on that morning means a lockfile,
// a registry, a network and a package manager all working on the one day they must not be a
// question. `node scripts/qr-sheet.js` works from a bare checkout, offline, on any Node 22+.
//
// The counter-argument -- that a hand-rolled encoder might emit a symbol no phone can read -- is
// answered by `--selftest`: it decodes every symbol back through the spec (format bits, mask,
// zigzag, de-interleave, Reed-Solomon syndromes, payload) and compares. See ADR-0010.
//
// Structure follows the reference decomposition in ISO/IEC 18004: encode -> codewords -> error
// correction -> interleave -> place -> mask -> format bits.

// --- GF(256), the field the Reed-Solomon codes live in ------------------------------------------
// Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 = 0x11d, as the spec requires.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

for (let i = 0, x = 1; i < 255; i += 1) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// --- the version tables -------------------------------------------------------------------------
// Indexed [level][version]; index 0 is unused so the version number indexes directly. Capped at
// version 10 on purpose: our payload is 33 bytes and the largest thing this repo will ever encode
// is a URL, so carrying the other thirty versions would be thirty more rows to get wrong.

export const MAX_VERSION = 10;

const ECC_CODEWORDS_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

const NUM_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 5, 8, 8],
};

/** The five-bit format field: L and M are deliberately not in numeric order. */
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

export const LEVELS = ['L', 'M', 'Q', 'H'];

/** Total modules available to data + error correction, function patterns already removed. */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignCount = Math.floor(version / 7) + 2;
    result -= (25 * alignCount - 10) * alignCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const totalCodewords = (version) => Math.floor(rawDataModules(version) / 8);

const dataCodewords = (version, level) =>
  totalCodewords(version) - ECC_CODEWORDS_PER_BLOCK[level][version] * NUM_BLOCKS[level][version];

/** Character-count indicator width for byte mode. Widens at version 10. */
const countBits = (version) => (version < 10 ? 8 : 16);

/** How many bytes of payload fit, after the mode indicator and the count. */
export const byteCapacity = (version, level) =>
  Math.floor((dataCodewords(version, level) * 8 - 4 - countBits(version)) / 8);

// --- Reed-Solomon --------------------------------------------------------------------------------

function rsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = mul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = mul(root, 2);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i += 1) result[i] ^= mul(divisor[i], factor);
  }
  return result;
}

// --- bit plumbing ---------------------------------------------------------------------------------

const bit = (value, index) => ((value >>> index) & 1) !== 0;

class Bits {
  constructor() {
    this.values = [];
  }

  push(value, length) {
    for (let i = length - 1; i >= 0; i -= 1) this.values.push((value >>> i) & 1);
  }

  get length() {
    return this.values.length;
  }

  toBytes() {
    const bytes = new Uint8Array(this.values.length / 8);
    this.values.forEach((value, index) => {
      if (value) bytes[index >>> 3] |= 0x80 >>> index % 8;
    });
    return bytes;
  }
}

/** Payload -> data codewords, including the terminator and the 0xEC/0x11 alternating pad. */
function toDataCodewords(bytes, version, level) {
  const bits = new Bits();
  bits.push(0b0100, 4); // byte mode
  bits.push(bytes.length, countBits(version));
  for (const byte of bytes) bits.push(byte, 8);

  const capacity = dataCodewords(version, level) * 8;
  bits.push(0, Math.min(4, capacity - bits.length));
  bits.push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) bits.push(pad, 8);

  return bits.toBytes();
}

/**
 * Split into blocks, append each block's error-correction codewords, then interleave. The
 * interleave is what makes a smudge survivable: a physically contiguous blot lands one or two
 * codewords in each block rather than wiping a single block out.
 */
function addEccAndInterleave(data, version, level) {
  const blockCount = NUM_BLOCKS[level][version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[level][version];
  const raw = totalCodewords(version);
  const shortBlockCount = blockCount - (raw % blockCount);
  const shortBlockLength = Math.floor(raw / blockCount);
  const divisor = rsDivisor(eccLength);

  const blocks = [];
  for (let i = 0, offset = 0; i < blockCount; i += 1) {
    const length = shortBlockLength - eccLength + (i < shortBlockCount ? 0 : 1);
    const block = Array.from(data.slice(offset, offset + length));
    offset += length;
    const ecc = Array.from(rsRemainder(block, divisor));
    if (i < shortBlockCount) block.push(0); // padding, skipped on the way out
    blocks.push(block.concat(ecc));
  }

  const result = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    for (let j = 0; j < blocks.length; j += 1) {
      if (i !== shortBlockLength - eccLength || j >= shortBlockCount) result.push(blocks[j][i]);
    }
  }
  return Uint8Array.from(result);
}

// --- the symbol ------------------------------------------------------------------------------------

function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (let pos = version * 4 + 10; positions.length < count; pos -= step) positions.splice(1, 0, pos);
  return positions;
}

class Symbol_ {
  constructor(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }

  setFunction(x, y, dark) {
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }

  drawFinder(x, y) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunction(xx, yy, distance !== 2 && distance !== 4);
        }
      }
    }
  }

  drawAlignment(x, y) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFunctionPatterns(level) {
    for (let i = 0; i < this.size; i += 1) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }

    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);

    const positions = alignmentPositions(this.version);
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = 0; j < positions.length; j += 1) {
        const corner =
          (i === 0 && j === 0) ||
          (i === 0 && j === positions.length - 1) ||
          (i === positions.length - 1 && j === 0);
        if (!corner) this.drawAlignment(positions[i], positions[j]);
      }
    }

    this.drawFormat(level, 0); // reserves the cells; rewritten once the mask is chosen
    this.drawVersion();
  }

  drawFormat(level, mask) {
    const data = (FORMAT_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (((data << 10) | rem) ^ 0x5412) >>> 0;

    for (let i = 0; i <= 5; i += 1) this.setFunction(8, i, bit(bits, i));
    this.setFunction(8, 7, bit(bits, 6));
    this.setFunction(8, 8, bit(bits, 7));
    this.setFunction(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i += 1) this.setFunction(14 - i, 8, bit(bits, i));

    for (let i = 0; i < 8; i += 1) this.setFunction(this.size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i += 1) this.setFunction(8, this.size - 15 + i, bit(bits, i));
    this.setFunction(8, this.size - 8, true); // the dark module, always
  }

  drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = ((this.version << 12) | rem) >>> 0;

    for (let i = 0; i < 18; i += 1) {
      const dark = bit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, dark);
      this.setFunction(b, a, dark);
    }
  }

  /** The two-module-wide upward/downward snake, right to left, skipping the vertical timing line. */
  eachDataModule(visit) {
    let index = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.reserved[y][x]) {
            visit(x, y, index);
            index += 1;
          }
        }
      }
    }
  }

  drawCodewords(codewords) {
    this.eachDataModule((x, y, index) => {
      if (index < codewords.length * 8) {
        this.modules[y][x] = bit(codewords[index >>> 3], 7 - (index % 8));
      }
    });
  }

  applyMask(mask) {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.reserved[y][x]) continue;
        if (maskAt(mask, x, y)) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  row(y) {
    return this.modules[y].map((dark) => (dark ? '1' : '0')).join('');
  }

  column(x) {
    return this.modules.map((row) => (row[x] ? '1' : '0')).join('');
  }
}

function maskAt(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** The four penalty rules of the spec, used only to pick the least-ugly of the eight masks. */
function penalty(symbol) {
  const { size } = symbol;
  let score = 0;
  let dark = 0;

  const lines = [];
  for (let i = 0; i < size; i += 1) {
    lines.push(symbol.row(i));
    lines.push(symbol.column(i));
  }

  for (const line of lines) {
    // Rule 1: runs of five or more.
    let run = 1;
    for (let i = 1; i <= line.length; i += 1) {
      if (i < line.length && line[i] === line[i - 1]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    // Rule 3: a finder-lookalike, 1:1:3:1:1 with four light modules beside it.
    const padded = `0000${line}0000`;
    for (let i = 0; i + 11 <= padded.length; i += 1) {
      const window = padded.slice(i, i + 11);
      if (window === '10111010000' || window === '00001011101') score += 40;
    }
  }

  // Rule 2: any 2x2 block of one colour.
  for (let y = 0; y + 1 < size; y += 1) {
    for (let x = 0; x + 1 < size; x += 1) {
      const value = symbol.modules[y][x];
      if (
        value === symbol.modules[y][x + 1] &&
        value === symbol.modules[y + 1][x] &&
        value === symbol.modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) if (symbol.modules[y][x]) dark += 1;
  }

  // Rule 4: how far the dark/light balance strays from even.
  const total = size * size;
  score += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/**
 * Encode `text` and return `{ version, size, modules }`, where `modules[y][x]` is true for dark.
 * The quiet zone is NOT included -- whoever draws the symbol owns it, and the sheet generator
 * draws four modules on every side.
 */
export function encodeQr(text, level = 'H', { minVersion = 1 } = {}) {
  if (!LEVELS.includes(level)) throw new Error(`unknown error-correction level "${level}"`);

  const bytes = new TextEncoder().encode(text);
  let version = minVersion;
  while (version <= MAX_VERSION && byteCapacity(version, level) < bytes.length) version += 1;
  if (version > MAX_VERSION) {
    throw new Error(
      `"${text}" is ${bytes.length} bytes; the largest supported symbol (version ${MAX_VERSION}, ` +
        `level ${level}) holds ${byteCapacity(MAX_VERSION, level)}`,
    );
  }

  const codewords = addEccAndInterleave(toDataCodewords(bytes, version, level), version, level);

  const symbol = new Symbol_(version);
  symbol.drawFunctionPatterns(level);
  symbol.drawCodewords(codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    symbol.applyMask(mask);
    symbol.drawFormat(level, mask);
    const score = penalty(symbol);
    if (best === null || score < best.score) best = { mask, score };
    symbol.applyMask(mask); // masking is its own inverse
  }

  symbol.applyMask(best.mask);
  symbol.drawFormat(level, best.mask);

  return { version, level, mask: best.mask, size: symbol.size, modules: symbol.modules };
}

// --- reading one back, which is the only honest way to trust the one above ------------------------

/**
 * Decode a symbol produced by `encodeQr` by walking the spec backwards: read the format bits, undo
 * the mask, read the zigzag, de-interleave the blocks, check every Reed-Solomon syndrome is zero,
 * then parse the byte-mode payload. It corrects nothing -- a single wrong module fails it, which
 * is exactly what a self-test wants.
 */
export function decodeQr({ version, size, modules }) {
  const symbol = new Symbol_(version);
  if (symbol.size !== size) throw new Error(`size ${size} is not version ${version}`);
  symbol.drawFunctionPatterns('L'); // any level: this only marks which cells are reserved
  symbol.modules = modules.map((row) => [...row]);

  // The 15 format bits, first copy, unscrambled.
  let format = 0;
  const read = (x, y) => (symbol.modules[y][x] ? 1 : 0);
  for (let i = 0; i <= 5; i += 1) format |= read(8, i) << i;
  format |= read(8, 7) << 6;
  format |= read(8, 8) << 7;
  format |= read(7, 8) << 8;
  for (let i = 9; i < 15; i += 1) format |= read(14 - i, 8) << i;
  format = (format ^ 0x5412) >>> 10;

  const level = LEVELS.find((name) => FORMAT_BITS[name] === (format >> 3)) ?? null;
  if (!level) throw new Error('format bits name no known error-correction level');
  const mask = format & 7;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!symbol.reserved[y][x] && maskAt(mask, x, y)) symbol.modules[y][x] = !symbol.modules[y][x];
    }
  }

  const raw = new Uint8Array(totalCodewords(version));
  symbol.eachDataModule((x, y, index) => {
    if (index < raw.length * 8 && symbol.modules[y][x]) raw[index >>> 3] |= 0x80 >>> index % 8;
  });

  // Undo the interleave, then check each block is a valid codeword.
  const blockCount = NUM_BLOCKS[level][version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[level][version];
  const shortBlockCount = blockCount - (raw.length % blockCount);
  const shortBlockLength = Math.floor(raw.length / blockCount);

  const blocks = Array.from({ length: blockCount }, () => []);
  let cursor = 0;
  for (let i = 0; i < shortBlockLength + 1; i += 1) {
    for (let j = 0; j < blockCount; j += 1) {
      if (i !== shortBlockLength - eccLength || j >= shortBlockCount) {
        blocks[j].push(raw[cursor]);
        cursor += 1;
      }
    }
  }

  const data = [];
  for (const block of blocks) {
    const remainder = rsRemainder(block, rsDivisor(eccLength));
    if (remainder.some((byte) => byte !== 0)) {
      throw new Error('Reed-Solomon syndrome is non-zero: the symbol does not decode cleanly');
    }
    data.push(...block.slice(0, block.length - eccLength));
  }

  const bits = [];
  for (const byte of data) for (let i = 7; i >= 0; i -= 1) bits.push((byte >>> i) & 1);
  const take = (count) => bits.splice(0, count).reduce((acc, value) => (acc << 1) | value, 0);

  if (take(4) !== 0b0100) throw new Error('payload is not byte mode');
  const length = take(countBits(version));
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = take(8);

  return { text: new TextDecoder().decode(bytes), version, level, mask };
}

/** The symbol as a standalone SVG string, with a quiet zone of `quiet` modules on every side. */
export function toSvg({ size, modules }, { quiet = 4, className = '' } = {}) {
  const span = size + quiet * 2;
  const parts = [];

  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (!modules[y][x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < size && modules[y][x + run]) run += 1;
      parts.push(`M${x + quiet} ${y + quiet}h${run}v1h-${run}z`);
      x += run;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" ` +
    `shape-rendering="crispEdges"${className ? ` class="${className}"` : ''}>` +
    `<rect width="${span}" height="${span}" fill="#fff"/>` +
    `<path d="${parts.join('')}" fill="#000"/>` +
    `</svg>`
  );
}

import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(kind, data) {
  const type = Buffer.from(kind),
    length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}
export async function pwaIcons(directory) {
  for (const size of [192, 512]) {
    const image = Buffer.alloc((size * 4 + 1) * size);
    for (let row = 0; row < size; row++)
      for (let column = 0; column < size; column++) {
        const x = (column * 512) / size,
          y = (row * 512) / size;
        const o =
          x >= 88 &&
          x <= 184 &&
          y >= 188 &&
          y <= 324 &&
          (x <= 108 || x >= 164 || y <= 208 || y >= 304);
        const a =
          y >= 188 &&
          y <= 324 &&
          (Math.abs(x - (254 - (y - 188) / 4)) < 10 ||
            Math.abs(x - (254 + (y - 188) / 4)) < 10 ||
            (y >= 264 && y <= 282 && x >= 228 && x <= 280));
        const cross =
          x >= 332 &&
          x <= 424 &&
          y >= 188 &&
          y <= 324 &&
          (Math.abs(x - (332 + ((y - 188) * 92) / 136)) < 10 ||
            Math.abs(x - (424 - ((y - 188) * 92) / 136)) < 10);
        const offset = row * (size * 4 + 1) + 1 + column * 4;
        image.set(
          o || a || cross ? [255, 255, 255, 255] : [8, 105, 93, 255],
          offset,
        );
      }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    await writeFile(
      `${directory}/icon-${size}.png`,
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(image)),
        chunk('IEND', Buffer.alloc(0)),
      ]),
    );
  }
}

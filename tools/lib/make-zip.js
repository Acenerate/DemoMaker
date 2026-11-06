// Builds a ZIP file in memory from whole folders, with no dependencies.
//
//   zipFolders(root, ['framework', 'walkthroughs'])  returns a Buffer; paths inside start at those folders
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { retry } = require('./fs-retry');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? filesIn(p) : d.isFile() ? [p] : [];
  });
}

// ZIP stores local time, to the nearest 2 seconds, and can't go before 1980.
function dosDateTime(ms) {
  const d = new Date(ms), year = Math.max(d.getFullYear(), 1980);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

function zipFolders(root, folders) {
  const locals = [], centrals = [];
  let offset = 0, count = 0;
  for (const folder of folders) {
    for (const file of filesIn(path.join(root, folder))) {
      const name = Buffer.from(path.relative(root, file).split(path.sep).join('/'));
      const data = retry(() => fs.readFileSync(file));
      const packed = zlib.deflateRawSync(data);
      const deflated = packed.length < data.length;   // audio and images often don't shrink
      const body = deflated ? packed : data;
      const { time, date } = dosDateTime(fs.statSync(file).mtimeMs);

      // The fields the file's local header and its central directory entry have in common.
      const shared = Buffer.alloc(26);
      shared.writeUInt16LE(20, 0);                // version needed to extract: 2.0
      shared.writeUInt16LE(0x0800, 2);            // flag: names are UTF-8
      shared.writeUInt16LE(deflated ? 8 : 0, 4);  // method: deflate or store
      shared.writeUInt16LE(time, 6);
      shared.writeUInt16LE(date, 8);
      shared.writeUInt32LE(crc32(data), 10);
      shared.writeUInt32LE(body.length, 14);
      shared.writeUInt32LE(data.length, 18);
      shared.writeUInt16LE(name.length, 22);

      const localSig = Buffer.alloc(4);
      localSig.writeUInt32LE(0x04034b50);
      locals.push(localSig, shared, name, body);

      const centralStart = Buffer.alloc(6);
      centralStart.writeUInt32LE(0x02014b50, 0);
      centralStart.writeUInt16LE(20, 4);          // version made by: 2.0
      const centralEnd = Buffer.alloc(14);        // comment, disk and attributes all zero, then offset
      centralEnd.writeUInt32LE(offset, 10);
      centrals.push(centralStart, shared, centralEnd, name);

      offset += 30 + name.length + body.length;
      count++;
    }
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

module.exports = { zipFolders };

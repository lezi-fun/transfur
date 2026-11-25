// The Electron build and packaged smoke test must check the same binaries.
const binaries = {
  bcrypto: 'bcrypto',
  bdb: 'leveldown',
  goosig: 'goosig',
  leveldown: 'leveldown',
  mrmr: 'mrmr',
  'node-hid': 'HID',
};

function nativeBinary(name) {
  return `node_modules/${name}/build/Release/${binaries[name] || name}.node`;
}

module.exports = {binaries, nativeBinary};

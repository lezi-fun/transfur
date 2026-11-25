// Build known runtime addons for the exact Electron ABI and the host architecture.
// bns uses its JavaScript resolver when optional libunbound is not installed.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {binaries, nativeBinary} = require('./lib/native-modules.cjs');

const root = path.resolve(__dirname, '..');
const target = require('../package.json').devDependencies.electron;
const gyp = require.resolve('node-gyp/bin/node-gyp.js');
const modules = Object.keys(binaries);
if (process.argv.includes('--include-unbound')) modules.push('unbound');

require('./force-goosig-mini-gmp')(root);
if (process.platform === 'win32' && process.arch === 'arm64') {
  // bcrypto 5.4.0 includes the x86 division-intrinsic header even on
  // native ARM64 MSVC. ARM64's __umulh is declared in intrin.h above it.
  const mpi = path.join(root, 'node_modules', 'bcrypto', 'deps', 'torsion', 'src', 'mpi.c');
  const original = '#if defined(MP_HAVE_MSVC) && _MSC_VER >= 1920 /* VS 2019 RTM */';
  const patched = '#if defined(MP_HAVE_MSVC) && _MSC_VER >= 1920 && (defined(_M_IX86) || defined(_M_X64) || defined(_M_AMD64))';
  const source = fs.readFileSync(mpi, 'utf8');
  if (!source.includes(patched)) {
    if (source.split(original).length !== 2) throw new Error('Unexpected bcrypto mpi.c; review the ARM64 include guard.');
    fs.writeFileSync(mpi, source.replace(original, patched));
  }
}
console.log(`Building native addons for Electron ${target} (${process.platform}-${process.arch})`);
for (const name of modules) {
  console.log(`\nBuilding ${name}`);
  const result = spawnSync(process.execPath, [gyp, 'rebuild',
    `--arch=${process.arch}`, `--target=${target}`, '--dist-url=https://electronjs.org/headers',
    `--devdir=${path.join(os.homedir(), '.electron-gyp')}`,
  ], {
    cwd: path.join(root, 'node_modules', name),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} build failed (${result.signal || result.status}).`);
  const output = nativeBinary(name);
  if (!fs.statSync(path.join(root, output), {throwIfNoEntry: false})?.isFile()) {
    throw new Error(`Native build did not produce ${output}.`);
  }
}

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

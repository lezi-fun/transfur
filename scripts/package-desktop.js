const path = require('node:path');
const fs = require('node:fs');
const {Arch, Platform, build} = require('electron-builder');
const {binaries, nativeBinary} = require('./lib/native-modules.cjs');

const root = path.resolve(__dirname, '..');
const {platform, arch} = process;
const options = process.argv.slice(2);
const dirOnly = options[0] === '--dir';
const targetPlatform = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : null;

async function main() {
  if (!targetPlatform || !['arm64', 'x64'].includes(arch) || options.length !== 1
      || (!dirOnly && options[0] !== targetPlatform)) {
    throw new Error(`Cannot package ${options.join(' ')} from ${platform}-${arch}. Use a native x64 or arm64 Node on the target OS.`);
  }
  for (const name of Object.keys(binaries)) {
    if (!fs.existsSync(path.join(root, nativeBinary(name)))) {
      throw new Error(`Missing ${nativeBinary(name)}. Run npm run postinstall before packaging.`);
    }
  }
  const target = dirOnly ? 'dir' : platform === 'darwin' ? 'dmg' : arch === 'arm64' ? 'nsis' : 'msi';
  const config = {directories: {output: `release/${platform}-${arch}`}};
  if (platform === 'darwin' && !process.env.CSC_LINK && !process.env.CSC_NAME) {
    // Apple Silicon requires signing even for a local build. This is only ad-hoc;
    // distribution signing and notarization require the maintainer's credentials.
    config.mac = {identity: '-', hardenedRuntime: false, notarize: false};
  }
  await build({
    projectDir: root,
    targets: (platform === 'darwin' ? Platform.MAC : Platform.WINDOWS).createTarget([target], Arch[arch]),
    config,
    publish: 'never',
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

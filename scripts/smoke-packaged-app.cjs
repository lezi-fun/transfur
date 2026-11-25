const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {binaries, nativeBinary} = require('./lib/native-modules.cjs');
const {runChild, validateSmokeResult} = require('./lib/packaged-smoke-runner.cjs');
const {productName, devDependencies} = require('../package.json');

async function main() {
  const mac = process.platform === 'darwin';
  const {platform, arch} = process;
  assert(mac || platform === 'win32', `Unsupported smoke host: ${platform}`);
  assert(['arm64', 'x64'].includes(arch), `Unsupported smoke architecture: ${arch}`);
  const root = path.resolve(__dirname, '..', 'release', `${platform}-${arch}`);
  const suffix = arch === 'x64' ? '' : `-${arch}`;
  const [mode, installedDir] = process.argv.slice(2);
  assert(!mode || mode === '--native-only' || (mode === '--installed' && !mac && installedDir),
    'Usage: smoke-packaged-app.cjs [--native-only | --installed WINDOWS_INSTALL_DIR]');
  const bundle = mac ? path.join(root, `mac${suffix}`, `${productName}.app`)
    : mode === '--installed' ? path.resolve(installedDir) : path.join(root, `win${suffix}-unpacked`);
  const executable = mac ? path.join(bundle, 'Contents', 'MacOS', productName) : path.join(bundle, `${productName}.exe`);
  const resources = path.join(bundle, ...(mac ? ['Contents', 'Resources'] : ['resources']));
  const addons = Object.keys(binaries).map(name => path.join(resources, 'app.asar.unpacked', nativeBinary(name)));
  const {stdout, stderr, result} = await runChild({
    executable,
    args: ['-e', `
      const assert = require('node:assert/strict');
      assert.equal(process.platform, ${JSON.stringify(platform)});
      assert.equal(process.arch, ${JSON.stringify(arch)});
      assert.equal(process.versions.electron, ${JSON.stringify(devDependencies.electron)});
      for (const addon of ${JSON.stringify(addons)}) require(addon);
      console.log('Native addon smoke passed');
    `],
    env: {...process.env, ELECTRON_RUN_AS_NODE: '1'},
  });
  assert.equal(result.code, 0, `Native addon smoke failed: ${JSON.stringify(result)}\n${stdout}\n${stderr}`);
  assert.match(stdout, /Native addon smoke passed/);
  if (mac) {
    const goosig = path.join(resources, 'app.asar.unpacked', nativeBinary('goosig'));
    const libraries = execFileSync('otool', ['-L', goosig], {encoding: 'utf8'});
    assert.doesNotMatch(libraries, /libgmp|\/opt\/gmp\/|Cellar\/gmp/i);
  }
  console.log(`Loaded all ${addons.length} bundled native addons in ${platform}-${arch} Electron.`);
  if (mode === '--native-only') return;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'furryfly-packaged-smoke-'));
  const reportPath = path.join(temp, 'report.json');
  const userData = path.join(temp, 'profile');
  const smokeProfile = 'existing-p2p-spv';
  fs.mkdirSync(userData);
  try {
    const env = {...process.env};
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.BOB_PACKAGED_ACCEPTANCE_TEST;
    const run = await runChild({executable, env: {...env,
      BOB_PACKAGED_SMOKE_TEST: 'true',
      BOB_SMOKE_USER_DATA: userData,
      BOB_SMOKE_REPORT: reportPath,
      BOB_SMOKE_PROFILE: smokeProfile,
    }, timeoutMs: 170000});
    validateSmokeResult({...run, reportPath, smokeProfile});
    console.log(`Packaged ${platform}-${arch} opened its window, started an isolated regtest node, reopened and shut down cleanly.`);
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

// Guards the single source of truth for the product identity.
//
// app/constants/branding.js is what the running app reads; package.json is what
// electron-builder and npm read. They cannot share code, so this test fails when
// the two drift apart - for example after editing the product name in only one
// place, which would ship an installer whose registered appId does not match the
// one the protocol handler reports.
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const pkg = require('../../package.json');
const BRAND = require('../../app/constants/branding.js');

test('branding module and package.json agree on the product identity', () => {
  assert.equal(pkg.productName, BRAND.displayName, 'package.json productName');
  assert.equal(pkg.build.productName, BRAND.displayName, 'electron-builder productName');
  assert.equal(pkg.name, BRAND.packageName, 'npm package name');
  assert.equal(pkg.build.appId, BRAND.appId, 'electron-builder appId');
  assert.equal(pkg.build.protocols.name, BRAND.packageName, 'protocol registration name');
});

test('the app registers exactly one URL scheme, and package.json declares it', () => {
  assert.deepEqual(pkg.build.protocols.schemes, [BRAND.protocol]);
  // A scheme must be a bare lowercase token: no colon, no slashes.
  assert.match(BRAND.protocol, /^[a-z][a-z0-9+.-]*$/);
});

test('the local port range cannot collide with Bob LearnHNS or upstream', () => {
  // Upstream Bob runs at base+0 and Bob LearnHNS at base+1000; anything equal
  // to either would make the two apps fight over hsd ports.
  assert.equal(Number.isInteger(BRAND.nodePortOffset), true, 'nodePortOffset is an integer');
  assert.ok(BRAND.nodePortOffset > 0, 'nodePortOffset is a positive shift');
  assert.notEqual(BRAND.nodePortOffset, 1000, 'must not reuse the LearnHNS offset');
});

test('the userData directory is its own name, not another product\'s', () => {
  // main.js joins appData() with this value. Renaming the product must not
  // silently move an existing profile unless that is the intent, so keep the
  // value explicit and non-empty.
  assert.match(BRAND.userDataDirName, /^[A-Za-z0-9._-]+$/);
  assert.equal(path.basename(BRAND.userDataDirName), BRAND.userDataDirName);
});

test('no source file still registers the retired schemes', () => {
  const fs = require('node:fs');
  const root = path.resolve(__dirname, '../..');
  const retired = [/\bbob-learnhns:/, /\bsetAsDefaultProtocolClient\('bob'/];
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test-dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|jsx)$/.test(entry.name) && !full.includes(`${path.sep}tests${path.sep}`)) {
        const text = fs.readFileSync(full, 'utf8');
        if (retired.some((rx) => rx.test(text))) offenders.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, 'app'));
  assert.deepEqual(offenders, [], 'files still referencing a retired scheme');
});

test('external service endpoints default to disabled, never to another product', () => {
  // A fork must not ship another product's telemetry or update feed.
  if (BRAND.updateRepo !== null) {
    assert.match(BRAND.updateRepo, /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, 'updateRepo is owner/name');
  }
  if (BRAND.sentryDsn !== null) {
    assert.match(BRAND.sentryDsn, /^https:\/\//, 'sentryDsn is an https URL');
  }
});

test('no source file points at the upstream Sentry project or release feed', () => {
  const fs = require('node:fs');
  const root = path.resolve(__dirname, '../..');
  const forbidden = [
    'sentry.io/1759225',
    'api.github.com/repos/kyokan',
    'github.com/kyokan/bob-wallet/releases/tag',
  ];
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (['node_modules', 'dist', 'test-dist', 'tests'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|jsx|cjs)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const needle of forbidden) {
          if (text.includes(needle)) offenders.push(`${path.relative(root, full)}: ${needle}`);
        }
      }
    }
  };
  walk(path.join(root, 'app'));
  assert.deepEqual(offenders, [], 'files still referencing an upstream endpoint');
});

test('the preferred chain directory is absolute and outside the repository', () => {
  if (BRAND.chainDir === null) return;
  assert.match(BRAND.chainDir, /^[A-Za-z]:\\/, 'chainDir must be an absolute Windows drive path');
  assert.ok(path.win32.isAbsolute(BRAND.chainDir));
  if (process.platform === 'win32') {
    const relative = path.relative(path.join(__dirname, '..', '..'), BRAND.chainDir);
    assert.ok(path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`),
      'chainDir must not point inside the repository');
  }
});

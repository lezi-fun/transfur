const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

async function main() {
  const [dir, extension] = process.argv.slice(2);
  assert(dir && ['dmg', 'exe', 'msi'].includes(extension), 'Usage: package-checksum.cjs DIR dmg|exe|msi');
  const files = fs.readdirSync(dir, {withFileTypes: true})
    .filter(entry => entry.isFile() && entry.name.endsWith(`.${extension}`));
  assert.equal(files.length, 1, `Expected exactly one .${extension} installer in ${dir}`);
  const installer = files[0].name;
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(path.join(dir, installer))) hash.update(chunk);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), `${hash.digest('hex')}  ${installer}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

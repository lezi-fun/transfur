#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// goosig already selects mini-gmp on Windows. On macOS its GYP default runs
// this probe, which can otherwise introduce a dependency on Homebrew's GMP.
// Set it before the Electron rebuild; never rebuild goosig for host Node after it.
module.exports = function forceGoosigMiniGmp(root) {
  if (process.platform === 'win32') return;
  const probe = path.join(root, 'node_modules', 'goosig', 'utils', 'has_gmp.sh');
  fs.accessSync(probe, fs.constants.F_OK);
  fs.writeFileSync(probe, '#!/bin/sh\nprintf "false\\n"\n', {mode: 0o755});
  fs.chmodSync(probe, 0o755);
};

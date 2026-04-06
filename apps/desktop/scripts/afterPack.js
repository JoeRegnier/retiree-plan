// electron-builder afterPack hook
// -----------------------------------------------------------------
// electron-builder hard-codes `return false` for any top-level
// "node_modules" directory inside extraResources (see createFilter
// in builder-util).  This hook copies the server node_modules that
// electron-builder refuses to include.
// -----------------------------------------------------------------

const path = require('path');
const fs = require('fs');

module.exports = async function afterPack(context) {
  const serverSrc = path.join(__dirname, '..', 'resources', 'server', 'node_modules');
  if (!fs.existsSync(serverSrc)) {
    console.log('[afterPack] No server node_modules to copy – skipping.');
    return;
  }

  const resourcesDir = context.packager.getResourcesDir(context.appOutDir);

  const serverDest = path.join(resourcesDir, 'server', 'node_modules');

  console.log(`[afterPack] Copying server node_modules\n  from: ${serverSrc}\n    to: ${serverDest}`);

  fs.cpSync(serverSrc, serverDest, { recursive: true });

  // Remove .bin symlinks and node_gyp_bins — they break macOS code signing
  // and are not needed at runtime.
  const binDir = path.join(serverDest, '.bin');
  if (fs.existsSync(binDir)) {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
  const gypBins = path.join(serverDest, 'bcrypt', 'build', 'node_gyp_bins');
  if (fs.existsSync(gypBins)) {
    fs.rmSync(gypBins, { recursive: true, force: true });
  }

  console.log('[afterPack] Done.');
};

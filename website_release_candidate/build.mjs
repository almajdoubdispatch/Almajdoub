import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const allowedRootFile = /\.(?:html|txt|xml|pdf)$/i;

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && allowedRootFile.test(entry.name)) {
    cpSync(join(root, entry.name), join(output, entry.name));
  }
}
const assets = join(root, 'assets');
if (!existsSync(assets)) throw new Error('Missing required website assets directory.');
cpSync(assets, join(output, 'assets'), { recursive: true });

console.log(`Prepared ${readdirSync(output).length} public website entries.`);

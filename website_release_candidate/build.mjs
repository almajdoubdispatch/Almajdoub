import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');

// Only these reviewed pages belong in the public website. Internal prototypes
// and operator cockpits must be added here only after an explicit review.
const publicRootFiles = [
  '404.html',
  'about.html',
  'accessibility.html',
  'Almajdoub_Carrier_Agreement_Packet.html',
  'Almajdoub_Carrier_Agreement_Packet.pdf',
  'carrier_app.html',
  'contact.html',
  'faq.html',
  'how-it-works.html',
  'index.html',
  'inquiry-success.html',
  'landing_14days_free.html',
  'onboarding-success.html',
  'onboarding.html',
  'pricing.html',
  'privacy.html',
  'referral_portal.html',
  'robots.txt',
  'services.html',
  'sitemap.xml',
  'terms.html',
];

// Copy only browser scripts referenced by the reviewed public pages.
const publicScripts = [
  'almajdoub_api.js',
  'almajdoub_db.js',
  'almajdoub_supabase.js',
  'cloud_config.js',
  'main.js',
  'pricing_catalog.js',
];

const publicImages = [
  'Almajdoub_Logo_Full_Color.png',
  'Almajdoub_Logo_White.png',
  'Almajdoub_Monogram_White.png',
  'dispatch-workstation-setup.jpg',
  'driver-cab-carrier-control.jpg',
  'dry-van-dock-facility.jpg',
  'favicon.ico',
  'logo-mark.svg',
  'rate-confirmation-review.jpg',
  'truck-dry-van-highway.jpg',
];

for (const file of publicRootFiles) {
  if (!existsSync(join(root, file))) throw new Error(`Missing public website file: ${file}`);
}
for (const file of publicScripts) {
  if (!existsSync(join(root, 'assets', 'js', file))) throw new Error(`Missing public website script: ${file}`);
}
for (const file of publicImages) {
  if (!existsSync(join(root, 'assets', 'img', file))) throw new Error(`Missing public website image: ${file}`);
}
for (const directory of ['css', 'img']) {
  if (!existsSync(join(root, 'assets', directory))) throw new Error(`Missing required website assets directory: assets/${directory}`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of publicRootFiles) {
  cpSync(join(root, file), join(output, file));
}

cpSync(join(root, 'assets', 'css'), join(output, 'assets', 'css'), { recursive: true });
mkdirSync(join(output, 'assets', 'img'), { recursive: true });
for (const file of publicImages) {
  cpSync(join(root, 'assets', 'img', file), join(output, 'assets', 'img', file));
}
mkdirSync(join(output, 'assets', 'js'), { recursive: true });
for (const file of publicScripts) {
  cpSync(join(root, 'assets', 'js', file), join(output, 'assets', 'js', file));
}

const publishedEntries = readdirSync(output, { recursive: true });
console.log(`Prepared ${publishedEntries.length} allowlisted public website entries.`);
console.log(`Excluded internal cockpit and prototype files from ${relative(root, output)}.`);


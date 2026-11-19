// Leonida Cover Lab — the hand-in program for the gta6-cover-art-01 bounty (Node 22, standard library only).
//
// The entry itself is the offline web app under app/: plain static files (app/index.html and its ES modules)
// that turn a photo and a caption into GTA-style multi-panel cover art in a desktop browser, with no network
// request and no build step. This program does the handing in: it copies app/ and screenshots/ from beside
// this file into the output directory and writes dossier.json there with buildDossier from the vendored
// make.fun library, byte for byte the summary the judge reads.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Try the app itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output app/ and screenshots/ so a re-run writes exactly the same bytes as a first run:
// stale files from an earlier hand-in would otherwise linger beside the fresh copies.
for (const name of ['app', 'screenshots']) {
  rmSync(join(outputDir, name), { recursive: true, force: true });
}
mkdirSync(outputDir, { recursive: true });

cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });

mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own caps, passed whole so this program refuses exactly what the scorer would refuse: only
// text_max_bytes shapes the dossier's bytes; the rest are limits (at most 4 screenshots of 256 KiB, app/
// at most 993 entries and 48 MiB, no app path over 1,000 UTF-8 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// A one-line receipt for whoever runs this by hand (the grader ignores stdout): where the hand-in went
// and how large the dossier came out, so a local run can be eyeballed against the gate's 1.5 MiB cap.
const dossierPath = join(outputDir, 'dossier.json');
console.log(`handed in: app/ and screenshots/ copied to ${outputDir}; dossier.json is ${statSync(dossierPath).size} bytes`);

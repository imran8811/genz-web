/**
 * `npm start` — the dev server, plus a watcher on the hero banner folder.
 *
 * `ng serve` watches `src/` and serves `public/` but knows nothing about the
 * generated slide list, so on its own an image added to
 * `public/images/home-banner-slider/` would not reach the carousel until the
 * next restart. Running the generator in watch mode alongside it closes that
 * gap: it rewrites a file under `src/`, which the dev server already watches,
 * so the page reloads by itself.
 *
 * Extra arguments go through to `ng serve` (e.g. `npm start -- --port 4300`).
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const root = resolve(scripts, '..');

const children = [];

function run(command, args) {
  // shell:true so the npm-provided node_modules/.bin resolution works on Windows.
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: true });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) if (!child.killed) child.kill();
}

run('node', [join(scripts, 'generate-banner-slides.mjs'), '--watch']);

const server = run('ng', ['serve', ...process.argv.slice(2)]);

// The dev server is the one that matters: when it stops, so does the watcher.
server.on('exit', (code) => {
  stopAll();
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAll();
    process.exit(0);
  });
}

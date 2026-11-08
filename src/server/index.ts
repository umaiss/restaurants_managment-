import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedIfEmpty } from './db.js';
import { getPort } from './config.js';
import { routeModules } from './routes/registry.js';
import { startBackgroundJobs } from './background.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(express.json());

// API and stream routes: one registry, mounted before the page catch-all below (BR11.4, BR14.1).
for (const mod of routeModules) {
  app.use(mod.mount, mod.router);
}

// Serve SPA — distDir relative to this file, works from any working directory.
// Use { root: distDir } form, never res.sendFile with an absolute path,
// because Express refuses absolute paths that pass through dot-folders (e.g. .aidlc/worktrees/).
const distDir = path.join(__dirname, '../../dist');

app.use(express.static(distDir));

app.get('*', (_req, res) => {
  res.sendFile('index.html', { root: distDir }, (err) => {
    if (err) {
      // In development the SPA is served by Vite. Return minimal HTML.
      res.status(200).send(`<!DOCTYPE html>
<html>
  <head><title>Table Order</title></head>
  <body>
    <div id="root">
      <p>Server running. Build the client with <code>npm run build</code> or use <code>npm run dev</code>.</p>
    </div>
  </body>
</html>`);
    }
  });
});

// Start the server only when this file is the entry point (not when imported by tests).
const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntry) {
  try {
    seedIfEmpty(); // opens the database and runs the upgrade; a failing step stops start-up here (BR11.1)
  } catch (err) {
    console.error('Start-up stopped:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
  startBackgroundJobs();
  const PORT = getPort();
  app.listen(PORT, () => {
    console.log(`Table Order running on http://localhost:${PORT}`);
  });
}

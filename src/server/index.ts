import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedIfEmpty } from './db.js';
import menuRouter from './routes/menu.js';
import ordersRouter from './routes/orders.js';
import billingRouter from './routes/billing.js';
import sseRouter from './routes/sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(express.json());

// API routes
app.use('/api', menuRouter);
app.use('/api', ordersRouter);
app.use('/api', billingRouter);

// SSE routes
app.use('/sse', sseRouter);

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
  seedIfEmpty();
  const PORT = parseInt(process.env.PORT ?? process.env.E2E_PORT ?? '3000', 10);
  app.listen(PORT, () => {
    console.log(`Table Order running on http://localhost:${PORT}`);
  });
}

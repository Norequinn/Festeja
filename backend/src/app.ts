import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import authRoutes from './routes/auth';
import spacesRoutes from './routes/spaces';
import membersRoutes from './routes/members';
import eventsRoutes from './routes/events';
import paymentsRoutes from './routes/payments';
import chatRoutes from './routes/chat';
import uploadsRoutes, { UPLOADS_DIR } from './routes/uploads';

const PUBLIC_WEB_DIR = path.resolve(__dirname, '../public');

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'festeja-api', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/spaces', spacesRoutes);
  app.use('/api/members', membersRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/uploads', uploadsRoutes);

  // Serve bundled Expo Web app from backend/public so a single tunnel exposes BOTH UI + API!
  if (fs.existsSync(PUBLIC_WEB_DIR)) {
    // Serve index.html with PWA manifest + iOS Apple Touch Icon tags injected
    const sendSpaHtml = (_req: express.Request, res: express.Response) => {
      const htmlPath = path.join(PUBLIC_WEB_DIR, 'index.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');
      const pwaHeadTags = [
        '<link rel="manifest" href="/manifest.json" />',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
        '<meta name="apple-mobile-web-app-capable" content="yes" />',
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
        '<meta name="apple-mobile-web-app-title" content="Festeja" />',
        '<meta name="mobile-web-app-capable" content="yes" />',
        '<meta name="theme-color" content="#FF821C" />',
        '<meta name="color-scheme" content="light dark" />',
      ].join('\n    ');
      if (!html.includes('rel="manifest"')) {
        html = html.replace('</head>', `    ${pwaHeadTags}\n  </head>`);
      }
      html = html.replace(/<title>.*?<\/title>/, '<title>Festeja — Celebraciones de Equipo</title>');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    };

    app.get('/', sendSpaHtml);
    app.use(express.static(PUBLIC_WEB_DIR, { index: false }));
    app.get(/^(?!\/api|\/uploads).*/, sendSpaHtml);
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const AEC_API_URL = process.env.AEC_API_URL || 'https://aecautopilot.aecplayhouse.com';
  const AEC_API_KEY = process.env.AEC_API_KEY || '';

  // Proxy endpoint for customer success API
  app.post('/api/customer-success', async (req, res) => {
    try {
      const clientKey = req.headers.apikey || req.headers.ApiKey || AEC_API_KEY;
      const apiUrl = `${AEC_API_URL.replace(/\/$/, '')}/customer-success`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clientKey) {
        headers['apikey'] = String(clientKey);
      }

      console.log(`[Proxy] Forwarding request to ${apiUrl}. EventType: ${req.body?.eventType}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('[Proxy Error] Failed to proxy request:', error);
      res.status(500).json({
        error: {
          message: error.message || 'Internal Server Error forwarding request to AEC Autopilot API'
        }
      });
    }
  });

  // Config endpoint to get API configurations (hiding actual API Key for security)
  app.get('/api/config', (req, res) => {
    res.json({
      apiUrl: AEC_API_URL,
      hasApiKey: !!AEC_API_KEY,
    });
  });

  if (process.env.NODE_ENV === 'production') {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Spin up Vite in middleware mode in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] CS Command Center Server running on http://0.0.0.0:${port} (${process.env.NODE_ENV || 'development'} mode)`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Critical startup failure:', err);
  process.exit(1);
});

// server.js — Servidor principal ENTELSAT Voice Backend

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { acceptCall } from './sideband.js';
import { avisosStore, panelClients } from './toolHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', true);
app.use(express.json());

// ─── CORS + CSP ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data:; " +
    "connect-src 'self' ws: wss:;"
  );
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── PANEL ESTÁTICO ───────────────────────────────────────────────────────────
const panelPath = join(__dirname, '..', 'panel');
if (existsSync(panelPath)) {
  app.use('/panel', express.static(panelPath));
  console.log('[PANEL] Disponible en /panel');
}

// ─── REDIRECT RAÍZ → PANEL ───────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/panel'));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  res.json({
    ok: true,
    service: 'ENTELSAT Voice Backend',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    activeCalls: (await import('./sideband.js')).getActiveSessions().size,
    timestamp: new Date().toISOString(),
  });
});

// ─── WEBHOOK OPENAI ───────────────────────────────────────────────────────────
// Este es el endpoint que OpenAI llama cuando entra una llamada SIP
app.post('/openai-webhook', async (req, res) => {
  const event = req.body;

  console.log(`[WEBHOOK] Evento recibido: ${event?.type}`);

  // Verificación básica del evento
  if (!event || event.type !== 'realtime.call.incoming') {
    console.warn('[WEBHOOK] Evento ignorado:', event?.type);
    return res.status(200).json({ ok: true });
  }

  const callId = event.call_id;

  if (!callId) {
    console.error('[WEBHOOK] Sin call_id en el evento');
    return res.status(400).json({ error: 'No call_id' });
  }

  console.log(`[WEBHOOK] Nueva llamada entrante: ${callId}`);

  // Responder inmediatamente a OpenAI (no hacer await aquí)
  res.status(200).json({ ok: true });

  // Aceptar la llamada en background
  try {
    await acceptCall(callId);
    console.log(`[WEBHOOK] Llamada ${callId} aceptada y sideband activo`);
  } catch (err) {
    console.error(`[WEBHOOK] Error aceptando llamada ${callId}:`, err.message);
  }
});

// ─── API PANEL DE RECEPCIÓN ───────────────────────────────────────────────────
// Devuelve los últimos avisos (para carga inicial del panel)
app.get('/api/avisos', (req, res) => {
  const limite = parseInt(req.query.limite) || 50;
  res.json({
    ok: true,
    avisos: avisosStore.slice(0, limite),
    total: avisosStore.length,
  });
});

// Marcar aviso como atendido
app.post('/api/avisos/:id/atendido', (req, res) => {
  const { id } = req.params;
  const aviso = avisosStore.find(a => a.id === id);

  if (!aviso) {
    return res.status(404).json({ error: 'Aviso no encontrado' });
  }

  aviso.atendido = true;
  aviso.atendido_en = new Date().toISOString();

  // Notificar al panel
  const msg = JSON.stringify({ type: 'aviso_atendido', id });
  for (const client of panelClients) {
    try { client.send(msg); } catch { panelClients.delete(client); }
  }

  res.json({ ok: true });
});

// ─── SERVIDOR HTTP + WEBSOCKET ────────────────────────────────────────────────
const server = createServer(app);

// WebSocket para el panel de recepción en tiempo real
const wss = new WebSocketServer({ server, path: '/ws/panel' });

wss.on('connection', (ws, req) => {
  console.log(`[PANEL WS] Cliente conectado desde ${req.socket.remoteAddress}`);

  panelClients.add(ws);

  // Enviar avisos recientes al conectarse
  ws.send(JSON.stringify({
    type: 'sync',
    avisos: avisosStore.slice(0, 20),
  }));

  ws.on('close', () => {
    panelClients.delete(ws);
    console.log('[PANEL WS] Cliente desconectado');
  });

  ws.on('error', () => {
    panelClients.delete(ws);
  });

  // Ping para mantener conexión viva
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
      panelClients.delete(ws);
    }
  }, 30000);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════╗
║     ENTELSAT Voice Backend v1.0.0        ║
╠══════════════════════════════════════════╣
║  Puerto: ${PORT}                              ║
║  Webhook: POST /openai-webhook           ║
║  Panel WS: ws://host/ws/panel            ║
║  API:    GET  /api/avisos                ║
║  Health: GET  /health                    ║
╚══════════════════════════════════════════╝
  `);
});

// ─── MANEJO DE ERRORES GLOBALES ───────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[ERROR] Promesa no manejada:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Excepción no capturada:', err);
  // No cerrar el proceso en producción, solo loguear
});

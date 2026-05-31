// sideband.js — Conexión WebSocket sideband con OpenAI para escuchar function calls

import { WebSocket } from 'ws';
import { TOOLS, SYSTEM_INSTRUCTIONS } from './tools.js';
import { handleToolCall } from './toolHandler.js';

// Mapa de conexiones activas: call_id → WebSocket
const activeSessions = new Map();

export function getActiveSessions() {
  return activeSessions;
}

// ─── ACEPTAR LLAMADA ──────────────────────────────────────────────────────────

export async function acceptCall(callId) {
  const url = `https://api.openai.com/v1/realtime/calls/${callId}/accept`;

  console.log(`[OPENAI] Aceptando llamada ${callId}...`);

  const body = {
    model: 'gpt-4o-realtime-preview',
    modalities: ['audio', 'text'],
    instructions: SYSTEM_INSTRUCTIONS,
    voice: 'alloy',
    tools: TOOLS,
    tool_choice: 'auto',
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 600,
    },
    input_audio_transcription: {
      model: 'whisper-1',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Accept call failed ${res.status}: ${err}`);
  }

  const data = await res.json();
  console.log(`[OPENAI] Llamada aceptada:`, data);

  // Abrir WebSocket sideband
  await openSidebandWebSocket(callId);

  return data;
}

// ─── WEBSOCKET SIDEBAND ───────────────────────────────────────────────────────

async function openSidebandWebSocket(callId) {
  const wsUrl = `wss://api.openai.com/v1/realtime/calls/${callId}/sideband`;

  console.log(`[SIDEBAND] Abriendo WebSocket para call ${callId}...`);

  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  activeSessions.set(callId, ws);

  ws.on('open', () => {
    console.log(`[SIDEBAND] Conectado — call_id: ${callId}`);
  });

  ws.on('message', async (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    await handleSidebandEvent(event, callId, ws);
  });

  ws.on('close', (code, reason) => {
    console.log(`[SIDEBAND] Cerrado — call_id: ${callId} — código: ${code}`);
    activeSessions.delete(callId);
  });

  ws.on('error', (err) => {
    console.error(`[SIDEBAND] Error — call_id: ${callId}:`, err.message);
    activeSessions.delete(callId);
  });

  // Timeout de seguridad: 30 minutos máximo por llamada
  setTimeout(() => {
    if (activeSessions.has(callId)) {
      console.log(`[SIDEBAND] Timeout — cerrando call_id: ${callId}`);
      ws.close();
      activeSessions.delete(callId);
    }
  }, 30 * 60 * 1000);
}

// ─── MANEJO DE EVENTOS SIDEBAND ───────────────────────────────────────────────

async function handleSidebandEvent(event, callId, ws) {
  const { type } = event;

  switch (type) {
    case 'session.created':
      console.log(`[SIDEBAND] Sesión creada: ${event.session?.id}`);
      break;

    case 'response.function_call_arguments.done': {
      // La IA ha decidido llamar a una herramienta
      const { name, call_id: toolCallId, arguments: argsStr } = event;

      let args;
      try {
        args = JSON.parse(argsStr);
      } catch {
        console.error('[SIDEBAND] Args no parseables:', argsStr);
        break;
      }

      console.log(`[SIDEBAND] Tool call: ${name} (${toolCallId})`);

      // Ejecutar la herramienta
      let result;
      try {
        result = await handleToolCall(name, args, callId);
      } catch (err) {
        console.error(`[SIDEBAND] Error en tool ${name}:`, err.message);
        result = { ok: false, error: err.message };
      }

      // Devolver resultado a OpenAI para que la IA lo use en su respuesta
      const responseEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: toolCallId,
          output: JSON.stringify(result),
        },
      };

      ws.send(JSON.stringify(responseEvent));

      // Pedir a la IA que genere respuesta con el resultado
      ws.send(JSON.stringify({ type: 'response.create' }));

      console.log(`[SIDEBAND] Resultado enviado a OpenAI:`, result);
      break;
    }

    case 'conversation.item.input_audio_transcription.completed':
      // Log de lo que dijo el cliente (útil para depuración)
      console.log(`[TRANSCRIPCIÓN CLIENTE]: ${event.transcript}`);
      break;

    case 'response.audio_transcript.done':
      // Log de lo que dijo la IA
      console.log(`[TRANSCRIPCIÓN IA]: ${event.transcript}`);
      break;

    case 'error':
      console.error(`[SIDEBAND] Error OpenAI:`, event.error);
      break;

    case 'session.updated':
    case 'response.created':
    case 'response.done':
    case 'response.audio.done':
    case 'input_audio_buffer.speech_started':
    case 'input_audio_buffer.speech_stopped':
      // Eventos normales del flujo, no requieren acción
      break;

    default:
      // Log de eventos desconocidos para debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SIDEBAND] Evento: ${type}`);
      }
  }
}

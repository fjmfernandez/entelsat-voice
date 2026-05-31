// toolHandler.js — Procesa las llamadas a herramientas que hace la IA

import {
  enviarEmailAveria,
  enviarEmailLead,
  enviarTelegram,
  enviarN8n,
  buildTelegramMsgAveria,
  buildTelegramMsgLead,
} from './notifications.js';

// Almacén en memoria de avisos (para el panel de recepción en tiempo real)
// En producción esto iría a Supabase o Redis
export const avisosStore = [];

// Listeners del panel de recepción (WebSocket clients)
export const panelClients = new Set();

function broadcastAviso(aviso) {
  const msg = JSON.stringify({ type: 'nuevo_aviso', aviso });
  for (const client of panelClients) {
    try {
      client.send(msg);
    } catch (e) {
      panelClients.delete(client);
    }
  }
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

export async function handleToolCall(toolName, toolArgs, callId) {
  console.log(`[TOOL] Llamada: ${toolName}`, toolArgs);

  switch (toolName) {
    case 'crear_averia_hotel':
      return await procesarAveriaHotel(toolArgs, callId);

    case 'crear_averia_comunidad':
      return await procesarAveriaComunidad(toolArgs, callId);

    case 'crear_lead_presupuesto':
      return await procesarLead(toolArgs, callId);

    case 'transferir_a_humano':
      return await procesarTransferencia(toolArgs, callId);

    default:
      return { ok: false, error: `Herramienta desconocida: ${toolName}` };
  }
}

// ─── AVERÍA HOTEL ─────────────────────────────────────────────────────────────

async function procesarAveriaHotel(args, callId) {
  const datos = {
    ...args,
    tipo: 'averia_hotel',
    call_id: callId,
    fecha: new Date().toISOString(),
    id: `AV-${Date.now()}`,
  };

  // Guardar en memoria para el panel
  avisosStore.unshift(datos);
  if (avisosStore.length > 100) avisosStore.pop();

  // Broadcast al panel de recepción en tiempo real
  broadcastAviso(datos);

  // Enviar en paralelo (no bloqueante)
  const [n8nResult] = await Promise.allSettled([
    enviarN8n(process.env.N8N_WEBHOOK_AVERIA_HOTEL, datos),
    enviarEmailAveria(datos),
    // Solo Telegram si urgencia alta o crítica
    ...(args.urgencia === 'alta' || args.urgencia === 'crítica'
      ? [enviarTelegram(buildTelegramMsgAveria(datos))]
      : []),
  ]);

  const ticketId = n8nResult?.value?.ticket_id || datos.id;

  console.log(`[AVERÍA HOTEL] Procesada: ${ticketId} — ${datos.hotel}`);

  return {
    ok: true,
    ticket_id: ticketId,
    mensaje_para_cliente: `He registrado la avería de ${datos.servicio_afectado} en ${datos.hotel}. Tu número de referencia es ${ticketId}. El equipo técnico de ENTELSAT ha sido notificado y te contactará ${args.urgencia === 'crítica' || args.urgencia === 'alta' ? 'en el menor tiempo posible' : 'próximamente'}. ¿Hay algo más en lo que pueda ayudarte?`,
  };
}

// ─── AVERÍA COMUNIDAD ─────────────────────────────────────────────────────────

async function procesarAveriaComunidad(args, callId) {
  const datos = {
    ...args,
    tipo: 'averia_comunidad',
    call_id: callId,
    fecha: new Date().toISOString(),
    id: `AV-${Date.now()}`,
  };

  avisosStore.unshift(datos);
  if (avisosStore.length > 100) avisosStore.pop();
  broadcastAviso(datos);

  await Promise.allSettled([
    enviarN8n(process.env.N8N_WEBHOOK_AVERIA_HOTEL, datos), // mismo webhook, diferente tipo
    enviarEmailAveria(datos),
    ...(args.urgencia === 'alta' || args.urgencia === 'crítica'
      ? [enviarTelegram(buildTelegramMsgAveria(datos))]
      : []),
  ]);

  return {
    ok: true,
    ticket_id: datos.id,
    mensaje_para_cliente: `He registrado la incidencia en ${datos.comunidad}. El equipo de ENTELSAT ha sido notificado. ¿Necesitas algo más?`,
  };
}

// ─── LEAD PRESUPUESTO ─────────────────────────────────────────────────────────

async function procesarLead(args, callId) {
  const datos = {
    ...args,
    tipo: 'lead_presupuesto',
    call_id: callId,
    fecha: new Date().toISOString(),
    id: `LEAD-${Date.now()}`,
  };

  avisosStore.unshift(datos);
  if (avisosStore.length > 100) avisosStore.pop();
  broadcastAviso(datos);

  await Promise.allSettled([
    enviarN8n(process.env.N8N_WEBHOOK_LEAD, datos),
    enviarEmailLead(datos),
    enviarTelegram(buildTelegramMsgLead(datos)),
  ]);

  return {
    ok: true,
    id: datos.id,
    mensaje_para_cliente: `Perfecto, he registrado tu solicitud de presupuesto para ${datos.servicio_interes}. Un comercial de ENTELSAT se pondrá en contacto contigo${datos.mejor_horario ? ' en el horario que has indicado' : ' próximamente'}. ¿Tienes alguna otra pregunta?`,
  };
}

// ─── TRANSFERENCIA A HUMANO ───────────────────────────────────────────────────

async function procesarTransferencia(args, callId) {
  const datos = {
    tipo: 'transferencia_humano',
    motivo: args.motivo,
    resumen: args.resumen,
    call_id: callId,
    fecha: new Date().toISOString(),
    id: `TR-${Date.now()}`,
  };

  avisosStore.unshift(datos);
  if (avisosStore.length > 100) avisosStore.pop();
  broadcastAviso(datos);

  await enviarTelegram(
    `📞 <b>TRANSFERENCIA A HUMANO</b>\n\nMotivo: ${args.motivo}\n\nResumen: ${args.resumen}\n\nCall ID: ${callId}\n\n<i>Necesita atención inmediata</i>`
  );

  return {
    ok: true,
    mensaje_para_cliente: `Voy a transferirte con un técnico de ENTELSAT ahora mismo. Por favor, espera un momento.`,
    accion: 'transferir', // El servidor usará esto para ejecutar la transferencia SIP
  };
}

// notifications.js — Envío de notificaciones a email, Telegram y n8n

import nodemailer from 'nodemailer';

// ─── EMAIL ────────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const URGENCIA_EMOJI = {
  baja: '🟢',
  media: '🟡',
  alta: '🟠',
  crítica: '🔴',
};

export async function enviarEmailAveria(datos) {
  const emoji = URGENCIA_EMOJI[datos.urgencia] || '⚠️';
  const tipo = datos.tipo === 'averia_hotel' ? 'HOTEL' : 'COMUNIDAD';
  const nombre = datos.hotel || datos.comunidad || 'Desconocido';

  const subject = `[NUEVA AVERÍA ${tipo}] ${nombre} - ${datos.servicio_afectado} - Urgencia ${datos.urgencia}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${emoji} Nueva Avería Registrada</h2>
        <p style="margin: 5px 0 0; opacity: 0.8;">Recibida por asistente IA · ${new Date().toLocaleString('es-ES')}</p>
      </div>
      <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #666; width: 160px;">📍 ${tipo === 'HOTEL' ? 'Hotel' : 'Comunidad'}:</td>
              <td style="padding: 8px 0; font-weight: bold;">${nombre}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">📍 Municipio:</td>
              <td style="padding: 8px 0;">${datos.municipio || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">👤 Contacto:</td>
              <td style="padding: 8px 0;">${datos.persona_contacto}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">📞 Teléfono:</td>
              <td style="padding: 8px 0;"><a href="tel:${datos.telefono}">${datos.telefono}</a></td></tr>
          ${datos.email ? `<tr><td style="padding: 8px 0; color: #666;">📧 Email:</td>
              <td style="padding: 8px 0;">${datos.email}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; color: #666;">🔧 Servicio:</td>
              <td style="padding: 8px 0; font-weight: bold;">${datos.servicio_afectado}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">📌 Zona:</td>
              <td style="padding: 8px 0;">${datos.zona_afectada || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">⚡ Urgencia:</td>
              <td style="padding: 8px 0;"><strong style="color: ${datos.urgencia === 'crítica' ? '#dc3545' : datos.urgencia === 'alta' ? '#fd7e14' : '#000'}">${emoji} ${datos.urgencia.toUpperCase()}</strong></td></tr>
          ${datos.horario_disponible ? `<tr><td style="padding: 8px 0; color: #666;">🕐 Horario:</td>
              <td style="padding: 8px 0;">${datos.horario_disponible}</td></tr>` : ''}
        </table>

        <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid #1a1a2e;">
          <p style="margin: 0 0 8px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Descripción</p>
          <p style="margin: 0;">${datos.descripcion}</p>
        </div>

        ${datos.urgencia === 'alta' || datos.urgencia === 'crítica' ? `
        <div style="margin-top: 16px; padding: 16px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffc107;">
          <strong>⚠️ Acción recomendada:</strong> Contactar al cliente de forma inmediata.
        </div>` : ''}

        <div style="margin-top: 20px; font-size: 12px; color: #aaa; border-top: 1px solid #e9ecef; padding-top: 12px;">
          Call ID: ${datos.call_id || '-'} · ENTELSAT Voice System
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"ENTELSAT Voice" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_AVISOS,
    subject,
    html,
  });

  console.log(`[EMAIL] Avería enviada: ${subject}`);
}

export async function enviarEmailLead(datos) {
  const subject = `[NUEVO LEAD] ${datos.tipo_cliente} - ${datos.servicio_interes} - ${datos.municipio}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: #0d6efd; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">💼 Nuevo Lead Comercial</h2>
        <p style="margin: 5px 0 0; opacity: 0.8;">Recibido por asistente IA · ${new Date().toLocaleString('es-ES')}</p>
      </div>
      <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #666; width: 160px;">👤 Nombre:</td>
              <td style="padding: 8px 0; font-weight: bold;">${datos.nombre}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">📞 Teléfono:</td>
              <td style="padding: 8px 0;">${datos.telefono}</td></tr>
          ${datos.email ? `<tr><td style="padding: 8px 0; color: #666;">📧 Email:</td>
              <td style="padding: 8px 0;">${datos.email}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; color: #666;">🏢 Tipo:</td>
              <td style="padding: 8px 0;">${datos.tipo_cliente}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">🔧 Servicio:</td>
              <td style="padding: 8px 0; font-weight: bold;">${datos.servicio_interes}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">📍 Municipio:</td>
              <td style="padding: 8px 0;">${datos.municipio}</td></tr>
          ${datos.mejor_horario ? `<tr><td style="padding: 8px 0; color: #666;">🕐 Horario:</td>
              <td style="padding: 8px 0;">${datos.mejor_horario}</td></tr>` : ''}
        </table>
        ${datos.descripcion ? `
        <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid #0d6efd;">
          <p style="margin: 0;">${datos.descripcion}</p>
        </div>` : ''}
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"ENTELSAT Voice" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_AVISOS,
    subject,
    html,
  });
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────

export async function enviarTelegram(mensaje) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID_GUARDIA) {
    console.warn('[TELEGRAM] Credenciales no configuradas, saltando...');
    return;
  }

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID_GUARDIA,
        text: mensaje,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[TELEGRAM] Error:', err);
    } else {
      console.log('[TELEGRAM] Mensaje enviado');
    }
  } catch (e) {
    console.error('[TELEGRAM] Fallo de red:', e.message);
  }
}

export function buildTelegramMsgAveria(datos) {
  const emoji = URGENCIA_EMOJI[datos.urgencia] || '⚠️';
  const tipo = datos.tipo === 'averia_hotel' ? '🏨 HOTEL' : '🏘️ COMUNIDAD';
  const nombre = datos.hotel || datos.comunidad || 'Desconocido';

  return `${emoji} <b>NUEVA AVERÍA ${tipo}</b>

📍 <b>${nombre}</b> — ${datos.municipio || ''}
👤 ${datos.persona_contacto} · <a href="tel:${datos.telefono}">${datos.telefono}</a>
🔧 ${datos.servicio_afectado} · ${datos.zona_afectada || ''}
⚡ Urgencia: <b>${datos.urgencia.toUpperCase()}</b>

📝 ${datos.descripcion}

${datos.horario_disponible ? `🕐 Horario: ${datos.horario_disponible}` : ''}

<i>Registrado por ENTELSAT Voice · ${new Date().toLocaleString('es-ES')}</i>`;
}

export function buildTelegramMsgLead(datos) {
  return `💼 <b>NUEVO LEAD COMERCIAL</b>

👤 <b>${datos.nombre}</b> (${datos.tipo_cliente})
📞 <a href="tel:${datos.telefono}">${datos.telefono}</a>
🔧 ${datos.servicio_interes} — ${datos.municipio}
${datos.descripcion ? `📝 ${datos.descripcion}` : ''}
${datos.mejor_horario ? `🕐 Mejor horario: ${datos.mejor_horario}` : ''}

<i>Registrado por ENTELSAT Voice · ${new Date().toLocaleString('es-ES')}</i>`;
}

// ─── N8N ──────────────────────────────────────────────────────────────────────

export async function enviarN8n(webhookUrl, payload) {
  if (!webhookUrl) {
    console.warn('[N8N] URL no configurada para este tipo');
    return null;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[N8N] Error ${res.status}:`, await res.text());
      return null;
    }

    const data = await res.json();
    console.log('[N8N] Respuesta:', data);
    return data; // { ok: true, ticket_id: "AV-2026-..." }
  } catch (e) {
    console.error('[N8N] Fallo de red:', e.message);
    return null;
  }
}

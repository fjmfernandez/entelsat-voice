# ENTELSAT Voice Backend — Guía de despliegue

## Estructura del proyecto

```
entelsat-voice/
├── src/
│   ├── server.js         ← Servidor principal (Express + WebSocket)
│   ├── sideband.js       ← Conexión WebSocket con OpenAI
│   ├── toolHandler.js    ← Procesa las tool calls de la IA
│   ├── tools.js          ← Definición de herramientas y prompt del sistema
│   ├── notifications.js  ← Email, Telegram y n8n
│   └── static.js         ← Servir panel estático
├── panel/
│   └── index.html        ← Panel de recepción en tiempo real
├── .env.example          ← Variables de entorno (copiar a .env)
├── Dockerfile
└── package.json
```

## Paso 1 — Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Rellena todos los valores:
- `OPENAI_API_KEY` — Tu API key del proyecto twelio_llamadasia
- `OPENAI_PROJECT_ID` — proj_xOQou8Yc1G4loGzjkOTKwTL2
- `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID_GUARDIA` — Tu @Appsatbot
- `SMTP_*` — Credenciales IONOS
- `N8N_WEBHOOK_*` — URLs de tus webhooks en n8nentelsat.ddns.net

## Paso 2 — Instalar dependencias

```bash
npm install
```

## Paso 3 — Arrancar en desarrollo

```bash
npm run dev
```

El servidor arranca en http://localhost:3000
Panel disponible en http://localhost:3000/panel

## Paso 4 — Despliegue en Contabo con Coolify

### Opción A: Coolify (recomendado)
1. Sube el código a un repo Git privado
2. En Coolify → New Service → Node.js
3. Configura las variables de entorno en el panel de Coolify
4. Dominio: voice.entelsat.com
5. Puerto: 3000
6. Coolify gestiona HTTPS automáticamente

### Opción B: Manual con PM2
```bash
npm install -g pm2
pm2 start src/server.js --name entelsat-voice
pm2 save
pm2 startup
```

### Nginx (si no usas Coolify)
```nginx
server {
    listen 80;
    server_name voice.entelsat.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Luego: `certbot --nginx -d voice.entelsat.com`

## Paso 5 — Cambiar webhook en OpenAI

En el panel de OpenAI (proyecto twelio_llamadasia):
- Webhook actual: https://ai-receptionist-9454.twil.io/openai-webhook
- **Cambiar a: https://voice.entelsat.com/openai-webhook**

## Paso 6 — Verificar

Abre en el navegador:
- https://voice.entelsat.com/health → debe devolver JSON con ok: true
- https://voice.entelsat.com/panel → panel de recepción

Haz una llamada de prueba al número Twilio (+1 839 225 3427) y comprueba:
1. La IA contesta
2. Al registrar una avería, aparece en el panel
3. Llega email a averias@entelsat.com
4. Llega mensaje en Telegram si urgencia alta/crítica

## Flujo completo verificado

```
Llamada entra a Twilio
    ↓ SIP Trunk
OpenAI Realtime API
    ↓ realtime.call.incoming
POST https://voice.entelsat.com/openai-webhook
    ↓ acceptCall(call_id)
OpenAI acepta + abre sesión
    ↓ WebSocket sideband
IA conversa con el cliente
    ↓ function call: crear_averia_hotel
handleToolCall()
    ↓ paralelo
Email + Telegram + n8n + Panel WebSocket
    ↓
Panel recepción muestra tarjeta en tiempo real
    ↓
IA confirma al cliente con ticket_id
```

## Endpoints disponibles

| Método | URL | Descripción |
|--------|-----|-------------|
| GET | /health | Estado del servidor |
| POST | /openai-webhook | Webhook para OpenAI (evento call.incoming) |
| GET | /api/avisos | Lista de avisos recientes |
| POST | /api/avisos/:id/atendido | Marcar aviso como atendido |
| WS | /ws/panel | WebSocket para panel de recepción |
| GET | /panel | Panel de recepción |

## Troubleshooting

**La IA no contesta:**
- Verificar que el webhook de OpenAI apunta a voice.entelsat.com
- Revisar logs: `pm2 logs entelsat-voice`
- Comprobar OPENAI_API_KEY en .env

**No llegan emails:**
- Verificar credenciales SMTP en .env
- Probar con telnet: `telnet smtp.ionos.es 587`

**No llegan mensajes Telegram:**
- Verificar BOT_TOKEN y CHAT_ID
- Confirmar que el bot es admin del grupo/canal

**El panel no se actualiza:**
- Abrir DevTools → Network → WS
- Verificar que voice.entelsat.com soporta WebSocket (configurar en nginx/Coolify)

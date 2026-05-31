// Añade esto al server.js después de los middlewares
// para servir el panel desde el mismo servidor

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Servir panel estático
const panelPath = join(__dirname, '..', 'panel');
if (existsSync(panelPath)) {
  app.use('/panel', express.static(panelPath));
  console.log('Panel disponible en /panel');
}

const express = require('express');
const cors = require('cors');
const { PORT, CLEANUP_INTERVAL } = require('./config/constants');
const SocketManager = require('./services/socketManager');
const CommandService = require('./services/commandService');
const setupRoutes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

console.log('╔════════════════════════════════════════╗');
console.log('║  PROXY HTTP → TCP (JSON Protocol)    ║');
console.log('╚════════════════════════════════════════╝');
console.log(`Puerto HTTP: ${PORT}\n`);

// Servicios
const socketManager = new SocketManager();
const commandService = new CommandService(socketManager);

// Configurar rutas
setupRoutes(app, socketManager, commandService);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, error: 'Error interno' });
});

// Limpieza periódica
setInterval(() => {
  socketManager.cleanupDeadConnections();
}, CLEANUP_INTERVAL);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[✓] Servidor HTTP: http://localhost:${PORT}`);
  console.log(`[✓] Protocolo: JSON sobre TCP\n`);
});
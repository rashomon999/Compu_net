//index.js ¨(C:\Users\luisg\Desktop\compunet\Compu_net\project\proxy-http\src\index.js)
const express = require('express');
const cors = require('cors');
const net = require('net');

const app = express();
const PORT = 5000;
const JAVA_SERVER_HOST = 'localhost';
const JAVA_SERVER_PORT = 9090;

app.use(cors());
app.use(express.json());

console.log('╔════════════════════════════════════════╗');
console.log('║  PROXY HTTP → TCP (Sin WebSockets)    ║');
console.log('║  Solo peticiones HTTP request/response║');
console.log('╚════════════════════════════════════════╝');
console.log(`Puerto HTTP: ${PORT}`);
console.log(`Backend Java: ${JAVA_SERVER_HOST}:${JAVA_SERVER_PORT}\n`);

// Función mejorada para enviar comando y esperar respuesta
async function sendCommandAndWait(username, command, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = '';
    let timeout;
    let registered = false;
    
    const cleanup = () => {
      clearTimeout(timeout);
      socket.destroy();
    };
    
    socket.connect(JAVA_SERVER_PORT, JAVA_SERVER_HOST, () => {
      console.log(`[→] Conectado al servidor Java`);
      
      // Configurar timeout global
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout esperando respuesta del servidor'));
      }, timeoutMs);
    });
    
    socket.on('data', (data) => {
      buffer += data.toString();
      console.log(`[←] Recibido: ${data.toString().substring(0, 100)}`);
      
      // Primer mensaje: Bienvenida
      if (!registered && buffer.includes('Bienvenido')) {
        console.log(`[→] Registrando usuario: ${username}`);
        socket.write(`REGISTER ${username}\n`);
        buffer = '';
        registered = true;
        return;
      }
      
      // Segundo mensaje: Confirmación de registro
      if (registered && buffer.includes('Registrado como')) {
        console.log(`[→] Usuario registrado, enviando comando: ${command}`);
        socket.write(command + '\n');
        buffer = '';
        return;
      }
      
      // Tercer mensaje: Respuesta al comando
      if (registered && buffer.length > 0) {
        // Si es un error de registro
        if (buffer.includes('ERROR') && buffer.includes('usuario')) {
          cleanup();
          reject(new Error('Usuario ya existe o inválido'));
          return;
        }
        
        // Esperar respuesta completa (debe tener salto de línea o ser suficientemente largo)
        if (buffer.includes('\n') || buffer.length > 100) {
          cleanup();
          resolve(buffer.trim());
        }
      }
    });
    
    socket.on('error', (err) => {
      cleanup();
      console.error(`[✗] Error TCP: ${err.message}`);
      reject(new Error(`Error de conexión con el servidor Java: ${err.message}`));
    });
    
    socket.on('close', () => {
      if (buffer.length > 0 && registered) {
        cleanup();
        resolve(buffer.trim());
      }
    });
  });
}

// ==================== ENDPOINTS HTTP ====================

// Registrar usuario
app.post('/register', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Username requerido' 
      });
    }
    
    console.log(`[API] Registrando usuario: ${username}`);
    
    // Intentar registrar con el servidor Java
    const response = await sendCommandAndWait(username, 'LIST_USERS');
    
    res.json({ 
      success: true, 
      message: `Bienvenido ${username}`,
      username 
    });
  } catch (err) {
    console.error('[API] Error en register:', err.message);
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Enviar mensaje a usuario
app.post('/enviar', async (req, res) => {
  try {
    const { from, to, message } = req.body;
    
    if (!from || !to || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Faltan campos: from, to, message' 
      });
    }
    
    console.log(`[API] ${from} → ${to}: ${message}`);
    
    const response = await sendCommandAndWait(from, `MSG_USER ${to} ${message}`);
    
    res.json({ 
      success: true, 
      message: response,
      from,
      to,
      content: message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[API] Error en enviar:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Enviar mensaje a grupo
app.post('/enviar-grupo', async (req, res) => {
  try {
    const { from, grupo, message } = req.body;
    
    if (!from || !grupo || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Faltan campos: from, grupo, message' 
      });
    }
    
    console.log(`[API] ${from} → [GRUPO ${grupo}]: ${message}`);
    
    const response = await sendCommandAndWait(from, `MSG_GROUP ${grupo} ${message}`);
    
    res.json({ 
      success: true, 
      message: response,
      from,
      grupo,
      content: message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[API] Error en enviar-grupo:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Crear grupo
app.post('/grupos', async (req, res) => {
  try {
    const { nombre, creator } = req.body;
    
    if (!nombre || !creator) {
      return res.status(400).json({ 
        success: false,
        error: 'Faltan campos: nombre, creator' 
      });
    }
    
    console.log(`[API] Creando grupo: ${nombre} por ${creator}`);
    
    const response = await sendCommandAndWait(creator, `CREATE_GROUP ${nombre}`);
    
    res.json({ 
      success: true, 
      message: response,
      grupo: nombre,
      creator
    });
  } catch (err) {
    console.error('[API] Error en crear grupo:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Unirse a grupo
app.post('/grupos/unirse', async (req, res) => {
  try {
    const { grupo, username } = req.body;
    
    if (!grupo || !username) {
      return res.status(400).json({ 
        success: false,
        error: 'Faltan campos: grupo, username' 
      });
    }
    
    console.log(`[API] ${username} uniéndose a grupo: ${grupo}`);
    
    const response = await sendCommandAndWait(username, `JOIN_GROUP ${grupo}`);
    
    res.json({ 
      success: true, 
      message: response,
      grupo,
      username
    });
  } catch (err) {
    console.error('[API] Error en unirse a grupo:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Listar grupos
app.get('/grupos', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ 
        success: false,
        error: 'Username requerido' 
      });
    }
    
    console.log(`[API] Listando grupos para: ${username}`);
    
    const response = await sendCommandAndWait(username, 'LIST_GROUPS');
    
    res.json({ 
      success: true, 
      grupos: response
    });
  } catch (err) {
    console.error('[API] Error en listar grupos:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Ver historial con usuario
app.get('/historial/:usuario', async (req, res) => {
  try {
    const { usuario } = req.params;
    const { from } = req.query;
    
    if (!from) {
      return res.status(400).json({ 
        success: false,
        error: 'Parámetro "from" requerido' 
      });
    }
    
    console.log(`[API] Historial: ${from} ↔ ${usuario}`);
    
    const response = await sendCommandAndWait(from, `VIEW_HISTORY ${usuario}`);
    
    res.json({ 
      success: true, 
      historial: response,
      usuario,
      from
    });
  } catch (err) {
    console.error('[API] Error en historial:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Ver historial de grupo
app.get('/historial-grupo/:grupo', async (req, res) => {
  try {
    const { grupo } = req.params;
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ 
        success: false,
        error: 'Parámetro "username" requerido' 
      });
    }
    
    console.log(`[API] Historial grupo: ${grupo} (${username})`);
    
    const response = await sendCommandAndWait(username, `VIEW_GROUP_HISTORY ${grupo}`);
    
    res.json({ 
      success: true, 
      historial: response,
      grupo
    });
  } catch (err) {
    console.error('[API] Error en historial grupo:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Listar usuarios conectados
app.get('/usuarios', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ 
        success: false,
        error: 'Username requerido' 
      });
    }
    
    console.log(`[API] Listando usuarios para: ${username}`);
    
    const response = await sendCommandAndWait(username, 'LIST_USERS');
    
    res.json({ 
      success: true, 
      usuarios: response
    });
  } catch (err) {
    console.error('[API] Error en listar usuarios:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    proxy: 'running',
    javaServer: `${JAVA_SERVER_HOST}:${JAVA_SERVER_PORT}`
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint no encontrado' 
  });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ 
    success: false,
    error: 'Error interno del servidor' 
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[✓] Servidor HTTP escuchando en http://localhost:${PORT}`);
  console.log(`[✓] Listo para recibir peticiones\n`);
});
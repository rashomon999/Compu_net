const net = require('net');
const { JAVA_SERVER_HOST, JAVA_SERVER_PORT, MAX_BUFFER_SIZE } = require('../config/constants');

class SocketManager {
  constructor() {
    this.userSockets = new Map();
  }

  async getOrCreateSocket(username) {
    if (this.userSockets.has(username)) {
      const connection = this.userSockets.get(username);
      if (connection.registered && !connection.socket.destroyed) {
        console.log(`[♻️] Reutilizando conexión: ${username}`);
        return connection;
      } else {
        this.userSockets.delete(username);
      }
    }

    console.log(`[🔌] Nueva conexión: ${username}`);
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const connection = {
        socket,
        buffer: '',
        registered: false,
        pendingResolve: null,
        pendingReject: null
      };

      socket.connect(JAVA_SERVER_PORT, JAVA_SERVER_HOST, () => {
        console.log(`[→] Conectado (${username})`);
      });

      socket.on('data', (data) => {
        connection.buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = connection.buffer.indexOf('\n')) !== -1) {
          const jsonLine = connection.buffer.substring(0, newlineIndex).trim();
          connection.buffer = connection.buffer.substring(newlineIndex + 1);
          
          if (jsonLine.length === 0) continue;
          
          console.log(`[←] ${username}: ${jsonLine}`);
          
          try {
            const jsonResponse = JSON.parse(jsonLine);
            
            if (!connection.registered && jsonResponse.message?.includes('Bienvenido')) {
              const registerCmd = { command: 'REGISTER', username };
              const jsonString = JSON.stringify(registerCmd);
              socket.write(jsonString + '\n');
              console.log(`[→] Registrando: ${jsonString}`);
              continue;
            }

            if (!connection.registered && jsonResponse.message?.includes('Registrado como')) {
              connection.registered = true;
              this.userSockets.set(username, connection);
              console.log(`[✓] ${username} registrado`);
              resolve(connection);
              continue;
            }

            if (!connection.registered && !jsonResponse.success) {
              const error = new Error(jsonResponse.message || 'Error en registro');
              if (connection.pendingReject) connection.pendingReject(error);
              reject(error);
              socket.destroy();
              continue;
            }

            if (connection.registered && connection.pendingResolve) {
              connection.pendingResolve(jsonResponse);
              connection.pendingResolve = null;
              connection.pendingReject = null;
            }
            
          } catch (err) {
            console.error(`[✗] Error parseando JSON: ${err.message}`);
          }
        }
        
        if (connection.buffer.length > MAX_BUFFER_SIZE) {
          console.warn(`[⚠️] Buffer muy grande para ${username}`);
          connection.buffer = '';
        }
      });

      socket.on('error', (err) => {
        console.error(`[✗] Error TCP (${username}): ${err.message}`);
        this.userSockets.delete(username);
        if (connection.pendingReject) {
          connection.pendingReject(err);
        }
        reject(err);
      });

      socket.on('close', () => {
        console.log(`[~] Conexión cerrada: ${username}`);
        this.userSockets.delete(username);
      });
    });
  }

  disconnect(username) {
    const connection = this.userSockets.get(username);
    if (connection) {
      connection.socket.destroy();
      this.userSockets.delete(username);
      console.log(`[👋] ${username} desconectado`);
    }
  }

  cleanupDeadConnections() {
    console.log('[🧹] Limpiando conexiones...');
    for (const [username, conn] of this.userSockets.entries()) {
      if (conn.socket.destroyed) {
        this.userSockets.delete(username);
        console.log(`[🗑️] Eliminada: ${username}`);
      }
    }
  }

  getActiveConnectionsCount() {
    return this.userSockets.size;
  }

  // Métodos alias para compatibilidad
  async getOrCreateConnection(username) {
    return this.getOrCreateSocket(username);
  }
  
  getActiveConnections() {
    return this.getActiveConnectionsCount();
  }
}

//  EXPORTAR INSTANCIA, NO CLASE
module.exports = new SocketManager();

const { COMMAND_TIMEOUT } = require('../config/constants');

class CommandService {
  constructor(socketManager) {
    this.socketManager = socketManager;
  }

  /**
   * Registra un usuario (el socket ya lo hace automáticamente)
   */
  async register(username) {
    try {
      // getOrCreateSocket ya maneja el registro automáticamente
      const connection = await this.socketManager.getOrCreateSocket(username);
      
      if (connection.registered) {
        return { 
          success: true, 
          message: `Usuario ${username} registrado correctamente` 
        };
      } else {
        throw new Error('No se pudo completar el registro');
      }
    } catch (err) {
      return { 
        success: false, 
        error: err.message 
      };
    }
  }

  /**
   * Ejecuta un comando en el servidor TCP
   */
  async execute(username, commandObj, timeoutMs = COMMAND_TIMEOUT) {
    try {
      return await this.sendCommand(username, commandObj, timeoutMs);
    } catch (err) {
      return { 
        success: false, 
        error: err.message 
      };
    }
  }

  async sendCommand(username, commandObj, timeoutMs = COMMAND_TIMEOUT) {
    try {
      const connection = await this.socketManager.getOrCreateSocket(username);
      
      return new Promise((resolve, reject) => {
        connection.pendingResolve = resolve;
        connection.pendingReject = reject;
        
        const timeout = setTimeout(() => {
          connection.pendingResolve = null;
          connection.pendingReject = null;
          connection.buffer = '';
          reject(new Error(`Timeout: ${timeoutMs}ms`));
        }, timeoutMs);

        const jsonCommand = JSON.stringify(commandObj);
        connection.socket.write(jsonCommand + '\n');
        console.log(`[→] ${username}: ${jsonCommand}`);

        const originalResolve = connection.pendingResolve;
        const originalReject = connection.pendingReject;
        
        connection.pendingResolve = (data) => {
          clearTimeout(timeout);
          originalResolve(data);
        };
        
        connection.pendingReject = (err) => {
          clearTimeout(timeout);
          originalReject(err);
        };
      });
    } catch (err) {
      throw new Error(`Error de conexión: ${err.message}`);
    }
  }
}

module.exports = CommandService;

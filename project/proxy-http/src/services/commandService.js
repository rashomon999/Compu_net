const { COMMAND_TIMEOUT } = require('../config/constants');

class CommandService {
  constructor(socketManager) {
    this.socketManager = socketManager;
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
// ============================================
// js/iceClient.js - Cliente ICE CORREGIDO para Webpack
// ============================================

// ✅ Importar ChatSystem (se cargará cuando Ice esté disponible)
import './generated/ChatSystem.js';

// ✅ Función auxiliar para esperar a que Ice.js esté disponible
function waitForIce(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkIce = () => {
      if (typeof window.Ice !== 'undefined') {
        // Si ChatSystem no se inicializó, inicializarlo ahora
        if (window._chatSystemPending && window._initializeChatSystem) {
          console.log('🔄 Inicializando ChatSystem ahora...');
          window._initializeChatSystem(window.Ice);
          window._chatSystemPending = false;
        }
        resolve(window.Ice);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout esperando Ice.js'));
      } else {
        setTimeout(checkIce, 50);
      }
    };
    
    checkIce();
  });
}

class IceClientManager {
  constructor() {
    this.communicator = null;
    this.chatService = null;
    this.groupService = null;
    this.notificationService = null;
    this.voiceService = null;
    this.isConnected = false;
    this.notificationCallback = null;
    this.username = null;
  }

  async connect(username, serverHost = 'localhost', serverPort = 10000) {
    try {
      console.log(`🔌 Conectando a ICE: ws://${serverHost}:${serverPort}`);
      
      // ✅ Esperar a que Ice.js esté disponible
      let Ice;
      try {
        Ice = await waitForIce();
      } catch (error) {
        throw new Error('Ice.js no se cargó. Asegúrate de incluir <script src="https://unpkg.com/ice@3.7.10/lib/Ice.min.js"></script> en tu HTML ANTES del bundle.js');
      }
      
      console.log('✅ Ice.js detectado, versión:', Ice.stringVersion());
      
      // ✅ Verificar que ChatSystem esté cargado
      if (!Ice.ChatSystem) {
        console.error('❌ Ice.ChatSystem no está disponible');
        console.log('Ice object:', Ice);
        throw new Error('ChatSystem.js no se cargó correctamente. Verifica que esté en js/generated/');
      }
      
      console.log('✅ ChatSystem cargado:', Object.keys(Ice.ChatSystem));
      
      this.username = username;
      
      // Actualizar UI
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus('connecting');
      }
      
      // Inicialización de Ice
      const initData = new Ice.InitializationData();
      initData.properties = Ice.createProperties([
        ['Ice.Default.Protocol', 'ws'],
        ['Ice.Default.Host', serverHost],
        ['Ice.Default.Port', serverPort.toString()]
      ]);
      
      this.communicator = Ice.initialize(initData);
      console.log('✅ Communicator inicializado');
      
      // Conectar a servicios
      await this.connectToServices(serverHost, serverPort);
      
      this.isConnected = true;
      
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus('connected');
      }
      
      console.log('✅ Conectado exitosamente a servidor ICE');
      
      return true;
      
    } catch (error) {
      console.error('❌ Error conectando a ICE:', error);
      this.isConnected = false;
      
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus('disconnected');
      }
      
      throw error;
    }
  }

  async connectToServices(host, port) {
    try {
      console.log('📡 Conectando servicios ICE...');
      
      const Ice = window.Ice;
      
      // Formato de endpoints para WebSocket
      const endpoints = {
        chat: `ChatService:ws -h ${host} -p ${port}`,
        group: `GroupService:ws -h ${host} -p ${port}`,
        notification: `NotificationService:ws -h ${host} -p ${port}`,
        voice: `VoiceService:ws -h ${host} -p ${port}`
      };
      
      // ChatService (OBLIGATORIO)
      try {
        console.log('  🔗 Conectando ChatService...');
        const chatProxy = this.communicator.stringToProxy(endpoints.chat);
        this.chatService = await Ice.ChatSystem.ChatServicePrx.checkedCast(chatProxy);
        
        if (!this.chatService) {
          throw new Error('ChatService proxy retornó null. ¿Está el servidor corriendo?');
        }
        console.log('  ✅ ChatService conectado');
      } catch (err) {
        console.error('  ❌ Error en ChatService:', err);
        throw new Error(`No se pudo conectar a ChatService: ${err.message}\n\nVerifica que:\n1. El servidor ICE esté corriendo en puerto ${port}\n2. ChatService esté disponible\n3. Los archivos .ice estén correctamente generados`);
      }
      
      // GroupService (OBLIGATORIO)
      try {
        console.log('  🔗 Conectando GroupService...');
        const groupProxy = this.communicator.stringToProxy(endpoints.group);
        this.groupService = await Ice.ChatSystem.GroupServicePrx.checkedCast(groupProxy);
        
        if (!this.groupService) {
          throw new Error('GroupService proxy retornó null');
        }
        console.log('  ✅ GroupService conectado');
      } catch (err) {
        console.error('  ❌ Error en GroupService:', err);
        throw new Error(`No se pudo conectar a GroupService: ${err.message}`);
      }
      
      // NotificationService (OPCIONAL)
      try {
        console.log('  🔗 Conectando NotificationService...');
        const notifProxy = this.communicator.stringToProxy(endpoints.notification);
        this.notificationService = await Ice.ChatSystem.NotificationServicePrx.checkedCast(notifProxy);
        console.log('  ✅ NotificationService conectado');
      } catch (err) {
        console.warn('  ⚠️ NotificationService no disponible:', err.message);
        this.notificationService = null;
      }
      
      // VoiceService (OPCIONAL)
      try {
        console.log('  🔗 Conectando VoiceService...');
        const voiceProxy = this.communicator.stringToProxy(endpoints.voice);
        this.voiceService = await Ice.ChatSystem.VoiceServicePrx.checkedCast(voiceProxy);
        console.log('  ✅ VoiceService conectado');
      } catch (err) {
        console.warn('  ⚠️ VoiceService no disponible:', err.message);
        this.voiceService = null;
      }
      
      console.log('✅ Todos los servicios disponibles conectados');
      
    } catch (error) {
      console.error('❌ Error conectando servicios:', error);
      throw error;
    }
  }

  // ========================================================================
  // MENSAJES
  // ========================================================================

  async sendPrivateMessage(sender, recipient, message) {
    if (!this.chatService) throw new Error('No conectado a ICE - ChatService no disponible');
    try {
      const result = await this.chatService.sendPrivateMessage(sender, recipient, message);
      return result;
    } catch (error) {
      console.error('Error enviando mensaje privado:', error);
      throw error;
    }
  }

  async sendGroupMessage(sender, groupName, message) {
    if (!this.chatService) throw new Error('No conectado a ICE - ChatService no disponible');
    try {
      const result = await this.chatService.sendGroupMessage(sender, groupName, message);
      return result;
    } catch (error) {
      console.error('Error enviando mensaje grupal:', error);
      throw error;
    }
  }

  async getConversationHistory(user1, user2) {
    if (!this.chatService) throw new Error('No conectado a ICE - ChatService no disponible');
    try {
      return await this.chatService.getConversationHistory(user1, user2);
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  }

  async getGroupHistory(groupName, username) {
    if (!this.chatService) throw new Error('No conectado a ICE - ChatService no disponible');
    try {
      return await this.chatService.getGroupHistory(groupName, username);
    } catch (error) {
      console.error('Error obteniendo historial de grupo:', error);
      throw error;
    }
  }

  async getRecentConversations(username) {
    if (!this.chatService) throw new Error('No conectado a ICE - ChatService no disponible');
    try {
      return await this.chatService.getRecentConversations(username);
    } catch (error) {
      console.error('Error obteniendo conversaciones recientes:', error);
      throw error;
    }
  }

  // ========================================================================
  // GRUPOS
  // ========================================================================

  async createGroup(groupName, creator) {
    if (!this.groupService) throw new Error('No conectado a ICE - GroupService no disponible');
    try {
      return await this.groupService.createGroup(groupName, creator);
    } catch (error) {
      console.error('Error creando grupo:', error);
      throw error;
    }
  }

  async joinGroup(groupName, username) {
    if (!this.groupService) throw new Error('No conectado a ICE - GroupService no disponible');
    try {
      return await this.groupService.joinGroup(groupName, username);
    } catch (error) {
      console.error('Error uniéndose a grupo:', error);
      throw error;
    }
  }

  async listUserGroups(username) {
    if (!this.groupService) throw new Error('No conectado a ICE - GroupService no disponible');
    try {
      const groupsInfo = await this.groupService.listUserGroups(username);
      return groupsInfo.map(g => g.name);
    } catch (error) {
      console.error('Error listando grupos:', error);
      throw error;
    }
  }

  async getGroupMembers(groupName) {
    if (!this.groupService) throw new Error('No conectado a ICE - GroupService no disponible');
    try {
      return await this.groupService.getGroupMembers(groupName);
    } catch (error) {
      console.error('Error obteniendo miembros del grupo:', error);
      throw error;
    }
  }

  // ========================================================================
  // NOTIFICACIONES EN TIEMPO REAL
  // ========================================================================

  async subscribeToNotifications(username, callbacks) {
    if (!this.notificationService) {
      console.warn('⚠️ NotificationService no disponible, las notificaciones en tiempo real no funcionarán');
      return;
    }
    
    try {
      console.log('📢 Suscribiendo a notificaciones...');
      
      const Ice = window.Ice;
      
      const callbackObj = {
        onNewMessage: (msg) => {
          console.log('📬 Nuevo mensaje:', msg);
          if (callbacks.onNewMessage) {
            callbacks.onNewMessage(msg);
          }
        },
        
        onGroupCreated: (groupName, creator) => {
          console.log('📢 Grupo creado:', groupName);
          if (callbacks.onGroupCreated) {
            callbacks.onGroupCreated(groupName, creator);
          }
        },
        
        onUserJoinedGroup: (groupName, user) => {
          console.log('👥 Usuario se unió:', user, 'a', groupName);
          if (callbacks.onUserJoinedGroup) {
            callbacks.onUserJoinedGroup(groupName, user);
          }
        }
      };
      
      const adapter = await this.communicator.createObjectAdapter("");
      const identity = Ice.generateUUID();
      const callbackProxy = adapter.add(
        new Ice.ChatSystem.NotificationCallback(callbackObj),
        new Ice.Identity(identity, "")
      );
      await adapter.activate();
      
      await this.notificationService.subscribe(
        username, 
        Ice.ChatSystem.NotificationCallbackPrx.uncheckedCast(callbackProxy)
      );
      
      console.log('✅ Suscrito a notificaciones');
      
    } catch (error) {
      console.error('Error suscribiéndose a notificaciones:', error);
      throw error;
    }
  }

  async unsubscribeFromNotifications(username) {
    if (!this.notificationService) return;
    try {
      await this.notificationService.unsubscribe(username);
      console.log('🔕 Desuscrito de notificaciones');
    } catch (error) {
      console.error('Error desuscribiéndose:', error);
    }
  }

  // ========================================================================
  // NOTAS DE VOZ
  // ========================================================================

  async saveVoiceNote(sender, target, audioDataBase64, isGroup) {
    if (!this.voiceService) {
      throw new Error('VoiceService no disponible. Las notas de voz no están habilitadas en el servidor.');
    }
    try {
      const result = await this.voiceService.saveVoiceNote(
        sender, target, audioDataBase64, isGroup
      );
      return result;
    } catch (error) {
      console.error('Error guardando nota de voz:', error);
      throw error;
    }
  }

  async getVoiceNote(audioFileRef) {
    if (!this.voiceService) {
      throw new Error('VoiceService no disponible');
    }
    try {
      return await this.voiceService.getVoiceNote(audioFileRef);
    } catch (error) {
      console.error('Error obteniendo nota de voz:', error);
      throw error;
    }
  }

  async getVoiceNotesHistory(user1, user2) {
    if (!this.voiceService) {
      throw new Error('VoiceService no disponible');
    }
    try {
      return await this.voiceService.getVoiceNotesHistory(user1, user2);
    } catch (error) {
      console.error('Error obteniendo historial de voz:', error);
      throw error;
    }
  }

  // ========================================================================
  // UTILIDADES
  // ========================================================================

  async disconnect() {
    if (this.username && this.notificationService) {
      await this.unsubscribeFromNotifications(this.username);
    }
    
    if (this.communicator) {
      try {
        await this.communicator.destroy();
        console.log('👋 Desconectado de ICE');
      } catch (error) {
        console.error('Error desconectando:', error);
      }
    }
    
    this.chatService = null;
    this.groupService = null;
    this.notificationService = null;
    this.voiceService = null;
    this.isConnected = false;
    
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus('disconnected');
    }
  }

  isClientConnected() {
    return this.isConnected;
  }
}

export const iceClient = new IceClientManager();
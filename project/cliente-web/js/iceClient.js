// ============================================
// js/iceClient.js - Cliente ICE con Sistema de Llamadas
// ============================================

import './generated/ChatSystem.js';

function waitForIce(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkIce = () => {
      if (typeof window.Ice !== 'undefined') {
        if (window._chatSystemPending && window._initializeChatSystem) {
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
    this.callService = null; // ⚡ NUEVO
    this.isConnected = false;
    this.notificationAdapter = null;
    this.callAdapter = null; // ⚡ NUEVO
    this.username = null;
    this.serverHost = 'localhost';
    this.serverPort = 10000;
    
    // Callbacks de llamadas
    this._onIncomingCall = null;
    this._onCallAccepted = null;
    this._onCallRejected = null;
    this._onCallColgada = null;
    this._onReceiveAudio = null;
  }

  getServerConfig() {
    const savedHost = localStorage.getItem('serverHost');
    const savedPort = localStorage.getItem('serverPort');
    
    return {
      host: savedHost || 'localhost',
      port: savedPort ? parseInt(savedPort) : 10000
    };
  }
  
  saveServerConfig(host, port) {
    localStorage.setItem('serverHost', host);
    localStorage.setItem('serverPort', port.toString());
  }

  async connect(username, serverHost = null, serverPort = null) {
    try {
      const config = this.getServerConfig();
      this.serverHost = serverHost || config.host;
      this.serverPort = serverPort || config.port;
      
      console.log(`🔌 Conectando a ICE: ws://${this.serverHost}:${this.serverPort}`);
      
      let Ice;
      try {
        Ice = await waitForIce();
      } catch (error) {
        throw new Error('Ice.js no se cargó correctamente');
      }
      
      console.log('✅ Ice.js detectado');
      
      if (!Ice.ChatSystem) {
        throw new Error('ChatSystem.js no se cargó correctamente');
      }
      
      this.username = username;
      
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus('connecting');
      }
      
      const initData = new Ice.InitializationData();
      initData.properties = Ice.createProperties([
        ['Ice.Default.Protocol', 'ws'],
        ['Ice.Default.Host', this.serverHost],
        ['Ice.Default.Port', this.serverPort.toString()]
      ]);
      
      this.communicator = Ice.initialize(initData);
      console.log('✅ Communicator inicializado');
      
      await this.connectToServices(this.serverHost, this.serverPort);
      
      this.saveServerConfig(this.serverHost, this.serverPort);
      
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
      
      // ChatService (OBLIGATORIO)
      try {
        console.log('  🔗 Conectando ChatService...');
        const chatProxy = this.communicator.stringToProxy(`ChatService:ws -h ${host} -p ${port}`);
        this.chatService = await Ice.ChatSystem.ChatServicePrx.checkedCast(chatProxy);
        
        if (!this.chatService) {
          throw new Error('ChatService proxy retornó null');
        }
        console.log('  ✅ ChatService conectado');
      } catch (err) {
        throw new Error(`No se pudo conectar a ChatService en ${host}:${port}`);
      }
      
      // GroupService (OBLIGATORIO)
      try {
        console.log('  🔗 Conectando GroupService...');
        const groupProxy = this.communicator.stringToProxy(`GroupService:ws -h ${host} -p ${port}`);
        this.groupService = await Ice.ChatSystem.GroupServicePrx.checkedCast(groupProxy);
        
        if (!this.groupService) {
          throw new Error('GroupService proxy retornó null');
        }
        console.log('  ✅ GroupService conectado');
      } catch (err) {
        throw new Error(`No se pudo conectar a GroupService: ${err.message}`);
      }
      
      // NotificationService (OPCIONAL)
      try {
        console.log('  🔗 Conectando NotificationService...');
        const notifProxy = this.communicator.stringToProxy(`NotificationService:ws -h ${host} -p ${port}`);
        this.notificationService = await Ice.ChatSystem.NotificationServicePrx.checkedCast(notifProxy);
        console.log('  ✅ NotificationService conectado');
      } catch (err) {
        console.warn('  ⚠️ NotificationService no disponible');
        this.notificationService = null;
      }
      
      // VoiceService (OPCIONAL)
      try {
        console.log('  🔗 Conectando VoiceService...');
        const voiceProxy = this.communicator.stringToProxy(`VoiceService:ws -h ${host} -p ${port}`);
        this.voiceService = await Ice.ChatSystem.VoiceServicePrx.checkedCast(voiceProxy);
        console.log('  ✅ VoiceService conectado');
      } catch (err) {
        console.warn('  ⚠️ VoiceService no disponible');
        this.voiceService = null;
      }
      
      // ⚡ CallService (OPCIONAL)
      try {
        console.log('  🔗 Conectando CallService...');
        const callProxy = this.communicator.stringToProxy(`CallService:ws -h ${host} -p ${port}`);
        this.callService = await Ice.ChatSystem.CallServicePrx.checkedCast(callProxy);
        console.log('  ✅ CallService conectado');
      } catch (err) {
        console.warn('  ⚠️ CallService no disponible');
        this.callService = null;
      }
      
      console.log('✅ Servicios conectados exitosamente');
      
    } catch (error) {
      console.error('❌ Error conectando servicios:', error);
      throw error;
    }
  }

  // ========================================================================
  // ⚡ LLAMADAS (SISTEMA PROFESOR - SIN WEBRTC)
  // ========================================================================

  async sendAudio(fromUser, audioData) {
    if (!this.callService) {
      console.warn('⚠️ CallService no disponible');
      return;
    }
    
    try {
      await this.callService.sendAudio(fromUser, audioData);
    } catch (error) {
      console.error('Error enviando audio:', error);
    }
  }

  async startCall(fromUser, toUser) {
    if (!this.callService) throw new Error('CallService no disponible');
    try {
      await this.callService.startCall(fromUser, toUser);
      console.log('✅ [ICE] startCall enviado');
    } catch (error) {
      console.error('❌ [ICE] Error en startCall:', error);
      throw error;
    }
  }

  async acceptCall(fromUser, toUser) {
    if (!this.callService) throw new Error('CallService no disponible');
    try {
      await this.callService.acceptCall(fromUser, toUser);
      console.log('✅ [ICE] acceptCall enviado');
    } catch (error) {
      console.error('❌ [ICE] Error en acceptCall:', error);
      throw error;
    }
  }

  async rejectCall(fromUser, toUser) {
    if (!this.callService) throw new Error('CallService no disponible');
    try {
      await this.callService.rejectCall(fromUser, toUser);
    } catch (error) {
      console.error('Error en rejectCall:', error);
    }
  }

  async colgar(fromUser, toUser) {
    if (!this.callService) throw new Error('CallService no disponible');
    try {
      await this.callService.colgar(fromUser, toUser);
    } catch (error) {
      console.error('Error en colgar:', error);
    }
  }

  async getConnectedUsers() {
    if (!this.callService) return [];
    try {
      return await this.callService.getConnectedUsers();
    } catch (error) {
      console.error('Error obteniendo usuarios conectados:', error);
      return [];
    }
  }

  // Callbacks
  onIncomingCall(callback) {
    this._onIncomingCall = callback;
  }

  onCallAccepted(callback) {
    this._onCallAccepted = callback;
  }

  onCallRejected(callback) {
    this._onCallRejected = callback;
  }

  onCallColgada(callback) {
    this._onCallColgada = callback;
  }

  onReceiveAudio(callback) {
    this._onReceiveAudio = callback;
  }

  async subscribeToCallEvents(username) {
    if (!this.callService) {
      throw new Error('CallService no disponible');
    }
    
    try {
      console.log('📞 Suscribiendo a eventos de llamadas...');
      
      const Ice = window.Ice;
      
      if (!this.callAdapter) {
        this.callAdapter = await this.communicator.createObjectAdapter("");
        await this.callAdapter.activate();
        console.log('   ✅ Call adapter creado');
      }
      
      const identity = Ice.generateUUID();
      
      const callbackObj = {
        receiveAudio: (data) => {
          if (this._onReceiveAudio) {
            this._onReceiveAudio(data);
          }
        },
        
        incomingCall: (fromUser) => {
          console.log('📞 [ICE] incomingCall de:', fromUser);
          if (this._onIncomingCall) {
            this._onIncomingCall(fromUser);
          }
        },
        
        callAccepted: (fromUser) => {
          console.log('✅ [ICE] callAccepted de:', fromUser);
          if (this._onCallAccepted) {
            this._onCallAccepted(fromUser);
          }
        },
        
        callRejected: (fromUser) => {
          console.log('❌ [ICE] callRejected de:', fromUser);
          if (this._onCallRejected) {
            this._onCallRejected(fromUser);
          }
        },
        
        callColgada: (fromUser) => {
          console.log('📴 [ICE] callColgada de:', fromUser);
          if (this._onCallColgada) {
            this._onCallColgada(fromUser);
          }
        }
      };
      
      const callbackProxy = this.callAdapter.add(
        new Ice.ChatSystem.CallCallback(callbackObj),
        new Ice.Identity(identity, "")
      );
      
      await this.callService.subscribe(
        username,
        Ice.ChatSystem.CallCallbackPrx.uncheckedCast(callbackProxy)
      );
      
      console.log('✅ Suscrito a eventos de llamadas');
      
    } catch (error) {
      console.error('❌ Error suscribiéndose a llamadas:', error);
      throw error;
    }
  }

  // ========================================================================
  // MENSAJES (mantenidos igual)
  // ========================================================================

  async sendPrivateMessage(sender, recipient, message) {
    if (!this.chatService) throw new Error('ChatService no disponible');
    try {
      return await this.chatService.sendPrivateMessage(sender, recipient, message);
    } catch (error) {
      console.error('Error enviando mensaje privado:', error);
      throw error;
    }
  }

  async sendGroupMessage(sender, groupName, message) {
    if (!this.chatService) throw new Error('ChatService no disponible');
    try {
      return await this.chatService.sendGroupMessage(sender, groupName, message);
    } catch (error) {
      console.error('Error enviando mensaje grupal:', error);
      throw error;
    }
  }

  async getConversationHistory(user1, user2) {
    if (!this.chatService) throw new Error('ChatService no disponible');
    try {
      return await this.chatService.getConversationHistory(user1, user2);
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  }

  async getGroupHistory(groupName, username) {
    if (!this.chatService) throw new Error('ChatService no disponible');
    try {
      return await this.chatService.getGroupHistory(groupName, username);
    } catch (error) {
      console.error('Error obteniendo historial de grupo:', error);
      throw error;
    }
  }

  async getRecentConversations(username) {
    if (!this.chatService) throw new Error('ChatService no disponible');
    try {
      return await this.chatService.getRecentConversations(username);
    } catch (error) {
      console.error('Error obteniendo conversaciones recientes:', error);
      throw error;
    }
  }

  // ========================================================================
  // GRUPOS (mantenidos igual)
  // ========================================================================

  async createGroup(groupName, creator) {
    if (!this.groupService) throw new Error('GroupService no disponible');
    try {
      return await this.groupService.createGroup(groupName, creator);
    } catch (error) {
      console.error('Error creando grupo:', error);
      throw error;
    }
  }

  async joinGroup(groupName, username) {
    if (!this.groupService) throw new Error('GroupService no disponible');
    try {
      return await this.groupService.joinGroup(groupName, username);
    } catch (error) {
      console.error('Error uniéndose a grupo:', error);
      throw error;
    }
  }

  async listUserGroups(username) {
    if (!this.groupService) throw new Error('GroupService no disponible');
    try {
      const groupsInfo = await this.groupService.listUserGroups(username);
      return groupsInfo.map(g => g.name);
    } catch (error) {
      console.error('Error listando grupos:', error);
      throw error;
    }
  }

  async getGroupMembers(groupName) {
    if (!this.groupService) throw new Error('GroupService no disponible');
    try {
      return await this.groupService.getGroupMembers(groupName);
    } catch (error) {
      console.error('Error obteniendo miembros del grupo:', error);
      throw error;
    }
  }

  // ========================================================================
  // NOTIFICACIONES (mantenidas igual)
  // ========================================================================

  async subscribeToNotifications(username, callbacks) {
    if (!this.notificationService) {
      console.warn('⚠️ NotificationService no disponible');
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
      
      if (!this.notificationAdapter) {
        this.notificationAdapter = await this.communicator.createObjectAdapter("");
        await this.notificationAdapter.activate();
        console.log('   ✅ Notification adapter creado');
      }
      
      const identity = Ice.generateUUID();
      const callbackProxy = this.notificationAdapter.add(
        new Ice.ChatSystem.NotificationCallback(callbackObj),
        new Ice.Identity(identity, "")
      );
      
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
  // NOTAS DE VOZ (mantenidas igual)
  // ========================================================================

  async saveVoiceNote(sender, target, audioDataBase64, isGroup) {
    if (!this.voiceService) {
      throw new Error('VoiceService no disponible');
    }
    try {
      return await this.voiceService.saveVoiceNote(sender, target, audioDataBase64, isGroup);
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
    
    if (this.notificationAdapter) {
      await this.notificationAdapter.destroy();
      this.notificationAdapter = null;
    }
    
    if (this.callAdapter) {
      await this.callAdapter.destroy();
      this.callAdapter = null;
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
    this.callService = null;
    this.isConnected = false;
    
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus('disconnected');
    }
  }

  isClientConnected() {
    return this.isConnected;
  }
  
  getCurrentServerInfo() {
    return {
      host: this.serverHost,
      port: this.serverPort,
      connected: this.isConnected
    };
  }
}

export const iceClient = new IceClientManager();
// ============================================
// js/iceClient.js - Cliente ICE SIMPLIFICADO
// ============================================

class IceClientManager {
  constructor() {
    this.communicator = null;
    this.chatService = null;
    this.groupService = null;
    this.notificationService = null;
    this.voiceService = null;
    this.callService = null;
    this.isConnected = false;
    this.notificationAdapter = null;
    this.callAdapter = null;
    this.username = null;
    this.serverHost = 'localhost';
    this.serverPort = 10000;

    this.audioSubject = null;
    this.audioAdapter = null;
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
      
      // ✅ VERIFICAR que Ice.js esté disponible
      const Ice = window.Ice;
      if (!Ice) {
        throw new Error('Ice.js no está disponible. Verifica que se cargue desde el CDN.');
      }
      
      console.log('✅ Ice.js detectado, versión:', Ice.stringVersion());
      
      // ✅ VERIFICAR que ChatSystem esté disponible
      if (!Ice.ChatSystem) {
        throw new Error('ChatSystem no está inicializado. Verifica que main.js lo haya inicializado.');
      }
      
      console.log('✅ ChatSystem disponible:', Object.keys(Ice.ChatSystem).length, 'elementos');
      
      // ✅ VERIFICAR que AudioSystem esté disponible (opcional)
      if (!Ice.AudioSystem) {
        console.warn('⚠️ AudioSystem no está disponible (las llamadas no funcionarán)');
      } else {
        console.log('✅ AudioSystem disponible:', Object.keys(Ice.AudioSystem).length, 'elementos');
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
        throw new Error(`No se pudo conectar a ChatService en ${host}:${port}\n\nVerifica que:\n1. El servidor ICE esté corriendo\n2. El firewall permita conexiones en el puerto ${port}\n3. Ambos dispositivos estén en la misma red`);
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
      
      // CallService (OPCIONAL)
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

  async connectToAudioSubject(host, port, username, observerCallbacks) {
    try {
      console.log('📞 Conectando a AudioSubject...');
      
      const Ice = window.Ice;
      
      // Verificar que AudioSystem esté disponible
      if (!Ice.AudioSystem) {
        throw new Error('AudioSystem no está inicializado. Verifica que main.js lo haya cargado.');
      }
      
      console.log('   ✅ AudioSystem encontrado:', Object.keys(Ice.AudioSystem).length, 'elementos');
      
      // PASO 1: Conectar al AudioSubject (servidor)
      const audioProxy = this.communicator.stringToProxy(
        `AudioService:ws -h ${host} -p ${port}`
      );
      
      this.audioSubject = await Ice.AudioSystem.AudioSubjectPrx.checkedCast(audioProxy);
      
      if (!this.audioSubject) {
        throw new Error('No se pudo conectar a AudioService');
      }
      
      console.log('   ✅ AudioSubject conectado');
      
      // PASO 2: Crear adaptador para callbacks
      if (!this.audioAdapter) {
        this.audioAdapter = await this.communicator.createObjectAdapter("");
        console.log('   ✅ Adaptador creado');
      }
      
      // PASO 3: Crear el Observer (callbacks del cliente)
      const observerObj = {
        receiveAudio: (data) => {
          const audioData = data instanceof Uint8Array 
            ? data 
            : new Uint8Array(data);
          
          if (observerCallbacks.receiveAudio) {
            observerCallbacks.receiveAudio(audioData);
          }
        },
        
        incomingCall: (fromUser) => {
          console.log('📞 [ICE] Llamada entrante de:', fromUser);
          if (observerCallbacks.incomingCall) {
            observerCallbacks.incomingCall(fromUser);
          }
        },
        
        callAccepted: (fromUser) => {
          console.log('✅ [ICE] Llamada aceptada por:', fromUser);
          if (observerCallbacks.callAccepted) {
            observerCallbacks.callAccepted(fromUser);
          }
        },
        
        callRejected: (fromUser) => {
          console.log('❌ [ICE] Llamada rechazada por:', fromUser);
          if (observerCallbacks.callRejected) {
            observerCallbacks.callRejected(fromUser);
          }
        },
        
        callEnded: (fromUser) => {
          console.log('📞 [ICE] Llamada finalizada por:', fromUser);
          if (observerCallbacks.callEnded) {
            observerCallbacks.callEnded(fromUser);
          }
        }
      };
      
      console.log('   ✅ Observer creado');
      
      // PASO 4: Crear proxy del Observer
      const observerProxy = this.audioAdapter.add(
        new Ice.AudioSystem.AudioObserver(observerObj),
        new Ice.Identity(Ice.generateUUID(), "")
      );
      
      console.log('   ✅ Proxy creado');
      
      // PASO 5: Activar adaptador
      await this.audioAdapter.activate();
      console.log('   ✅ Adaptador activado');
      
      // PASO 6: Registrarse en el servidor
      await this.audioSubject.attach(username, observerProxy);
      console.log('   ✅ Registrado en servidor');
      
      console.log('✅ Sistema de llamadas ACTIVO');
      return this.audioSubject;
      
    } catch (error) {
      console.error('❌ Error conectando AudioSubject:', error);
      throw error;
    }
  }

  async disconnectFromAudioSubject(username) {
    try {
      if (this.audioSubject && username) {
        await this.audioSubject.detach(username);
        console.log('👋 Desconectado de AudioSubject');
      }
      
      if (this.audioAdapter) {
        await this.audioAdapter.destroy();
        this.audioAdapter = null;
      }
      
      this.audioSubject = null;
      
    } catch (error) {
      console.warn('⚠️ Error desconectando AudioSubject:', error);
    }
  }

  // ========================================================================
  // MENSAJES
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
  // GRUPOS
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
  // NOTIFICACIONES
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
  // CLEANUP
  // ========================================================================

  async disconnect() {
    if (this.username && this.notificationService) {
      await this.unsubscribeFromNotifications(this.username);
    }
    
    if (this.notificationAdapter) {
      await this.notificationAdapter.destroy();
      this.notificationAdapter = null;
    }
    
    if (this.username) {
      await this.disconnectFromAudioSubject(this.username);
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

// Exportar instancia única
export const iceClient = new IceClientManager();
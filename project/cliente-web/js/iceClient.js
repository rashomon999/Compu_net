// ============================================
// js/iceClient.js - CORREGIDO: Observer recibe audio
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
    this.audioPollingInterval = null;
    this.audioCallbacks = null;
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
      
      const Ice = window.Ice;
      if (!Ice) {
        throw new Error('Ice.js no está disponible');
      }
      
      console.log('✅ Ice.js detectado, versión:', Ice.stringVersion());
      
      if (!Ice.ChatSystem) {
        throw new Error('ChatSystem no está inicializado');
      }
      
      console.log('✅ ChatSystem disponible:', Object.keys(Ice.ChatSystem).length, 'elementos');
      
      if (!Ice.AudioSystem) {
        console.warn('⚠️ AudioSystem no está disponible');
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
      console.log('📞 [AUDIO] Conectando a AudioSubject...');
      console.log('   Host:', host);
      console.log('   Port:', port);
      console.log('   Username:', username);
      
      const Ice = window.Ice;
      
      if (!Ice) {
        throw new Error('Ice no está disponible');
      }
      
      if (!Ice.AudioSystem) {
        throw new Error('AudioSystem no está inicializado');
      }
      
      console.log('   ✅ AudioSystem encontrado');
      
      // PASO 1: Conectar al AudioSubject (servidor)
      const audioProxyString = `AudioService:ws -h ${host} -p ${port}`;
      console.log('   Proxy string:', audioProxyString);
      
      const audioProxy = this.communicator.stringToProxy(audioProxyString);
      console.log('   ✅ Proxy creado');
      
      this.audioSubject = await Ice.AudioSystem.AudioSubjectPrx.checkedCast(audioProxy);
      
      if (!this.audioSubject) {
        throw new Error('No se pudo conectar a AudioService - checkedCast retornó null');
      }
      
      console.log('   ✅ AudioSubject conectado');
      
      // PASO 2: Guardar callbacks
      this.audioCallbacks = observerCallbacks;
      console.log('   ✅ Callbacks guardados');
      
      // PASO 3: Crear adaptador
      if (!this.audioAdapter) {
        console.log('   Creando adaptador...');
        this.audioAdapter = await this.communicator.createObjectAdapter("");
        console.log('   ✅ Adaptador creado');
      }
      
      // ========================================
      // 🔥 PASO 4: CREAR OBSERVER (COMO EL PROFESOR)
      // ========================================
      console.log('   Creando Observer (patrón del profesor)...');
      
      // Importar el subscriber
      const { default: AudioSubscriber } = await import('./subscriber.js');
      
      // Crear instancia del subscriber
      const subscriber = new AudioSubscriber({
        audioCallbacks: observerCallbacks
      });
      
      console.log('   ✅ AudioSubscriber creado');
      
      // PASO 5: Crear proxy del Observer (EXACTO como el profesor)
      console.log('   Creando proxy del Observer...');
      const observerProxy = this.audioAdapter.add(
        subscriber,
        new Ice.Identity(Ice.generateUUID(), "")
      );
      
      console.log('   ✅ Proxy del Observer creado');
      
      // PASO 6: Activar adaptador
      console.log('   Activando adaptador...');
      await this.audioAdapter.activate();
      console.log('   ✅ Adaptador activado');
      
      // PASO 7: Registrarse en el servidor
      console.log('   Registrándose en servidor...');
      await this.audioSubject.attach(username, observerProxy);
      console.log('   ✅ Registrado en servidor');
      
      // PASO 8: Iniciar polling (fallback)
      console.log('   🔄 Iniciando polling...');
      this.startAudioPolling(username);
      
      console.log('✅ Sistema de llamadas ACTIVO (callbacks + polling)');
      console.log('   📡 Observer escuchando audio en tiempo real');
      
      return this.audioSubject;
      
    } catch (error) {
      console.error('❌ [AUDIO] Error conectando AudioSubject:', error);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  // Polling para llamadas (fallback)
  startAudioPolling(username) {
  if (this.audioPollingInterval) {
    clearInterval(this.audioPollingInterval);
  }
  
  console.log('🔄 [AUDIO POLLING] Iniciando para:', username);
  
  // ✅ Contador de callbacks recibidos
  let callbacksReceived = 0;
  
  this.audioPollingInterval = setInterval(async () => {
    try {
      // Consultar llamadas aceptadas
      const acceptedCalls = await this.audioSubject.getPendingAcceptedCalls(username);
      if (acceptedCalls && acceptedCalls.length > 0) {
        console.log('✅ [AUDIO POLLING] Llamadas aceptadas:', acceptedCalls);
        
        // 🔥 SI YA SE RECIBIÓ POR CALLBACK, NO PROCESAR
        for (const fromUser of acceptedCalls) {
          callbacksReceived++;
          
          // Solo procesar si callbacks NO funcionaron (< 2 segundos)
          if (callbacksReceived === 1) {
            if (this.audioCallbacks.callAccepted) {
              this.audioCallbacks.callAccepted(fromUser);
            }
          }
        }
      }
      
      // ... resto del código igual
      
    } catch (error) {
      if (!error.message.includes('timeout')) {
        console.error('❌ [AUDIO POLLING] Error:', error);
      }
    }
  }, 1000);
  
  console.log('✅ [AUDIO POLLING] Polling activo');
}

  async disconnectFromAudioSubject(username) {
    try {
      // Detener polling
      if (this.audioPollingInterval) {
        clearInterval(this.audioPollingInterval);
        this.audioPollingInterval = null;
        console.log('🔄 Audio polling detenido');
      }
      
      if (this.audioSubject && username) {
        await this.audioSubject.detach(username);
        console.log('👋 Desconectado de AudioSubject');
      }
      
      if (this.audioAdapter) {
        await this.audioAdapter.destroy();
        this.audioAdapter = null;
      }
      
      this.audioSubject = null;
      this.audioCallbacks = null;
      
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
      console.log('📕 Desuscrito de notificaciones');
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

  // ========================================================================
  // NOTAS DE VOZ
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
  
  getCurrentServerInfo() {
    return {
      host: this.serverHost,
      port: this.serverPort,
      connected: this.isConnected
    };
  }


  // ============================================
// MÉTODO CORREGIDO en iceClient.js
// ============================================

async connectToAudioSubject(host, port, username, observerCallbacks) {
  try {
    console.log('📞 [AUDIO] Conectando a AudioSubject...');
    console.log('   Host:', host);
    console.log('   Port:', port);
    console.log('   Username:', username);
    
    const Ice = window.Ice;
    
    if (!Ice || !Ice.AudioSystem) {
      throw new Error('AudioSystem no está disponible');
    }
    
    console.log('   ✅ AudioSystem encontrado');
    
    // ========================================
    // PASO 1: CONECTAR AL SERVIDOR (AudioSubject)
    // ========================================
    const audioProxyString = `AudioService:ws -h ${host} -p ${port}`;
    console.log('   📡 Proxy string:', audioProxyString);
    
    const audioProxy = this.communicator.stringToProxy(audioProxyString);
    this.audioSubject = await Ice.AudioSystem.AudioSubjectPrx.checkedCast(audioProxy);
    
    if (!this.audioSubject) {
      throw new Error('checkedCast retornó null');
    }
    
    console.log('   ✅ AudioSubject conectado');
    
    // ========================================
    // 🔥 PASO 2: CREAR ADAPTADOR (COMO EL PROFESOR)
    // ========================================
    
    // Guardar callbacks
    this.audioCallbacks = observerCallbacks;
    
    // Crear adaptador vacío (sin endpoints explícitos)
    console.log('   🔧 Creando adaptador...');
    this.audioAdapter = await this.communicator.createObjectAdapter("");
    console.log('   ✅ Adaptador creado');
    
    // ========================================
    // 🔥 PASO 3: VINCULAR ADAPTADOR A LA CONEXIÓN
    // (ESTO ES LO QUE FALTABA)
    // ========================================
    console.log('   🔗 Vinculando adaptador a la conexión...');
    const connection = this.audioSubject.ice_getCachedConnection();
    
    if (!connection) {
      throw new Error('No hay conexión activa al servidor');
    }
    
    connection.setAdapter(this.audioAdapter);
    console.log('   ✅ Adaptador vinculado a la conexión');
    
    // ========================================
    // 🔥 PASO 4: CREAR Y REGISTRAR EL OBSERVER
    // ========================================
    console.log('   👤 Creando Observer...');
    
    // Importar subscriber
    const { default: AudioSubscriber } = await import('./subscriber.js');
    
    // Crear instancia (pasando self como delegate)
    const subscriber = new AudioSubscriber({
      audioCallbacks: observerCallbacks
    });
    
    console.log('   ✅ AudioSubscriber creado');
    
    // Agregar al adaptador con UUID
    console.log('   📋 Registrando Observer en el adaptador...');
    const observerProxy = this.audioAdapter.addWithUUID(subscriber);
    console.log('   ✅ Observer registrado en adaptador');
    
    // ========================================
    // 🔥 PASO 5: ACTIVAR ADAPTADOR
    // ========================================
    console.log('   ⚡ Activando adaptador...');
    await this.audioAdapter.activate();
    console.log('   ✅ Adaptador ACTIVO');
    
    // ========================================
    // 🔥 PASO 6: REGISTRARSE EN EL SERVIDOR
    // ========================================
    console.log('   📤 Registrándose en servidor con attach()...');
    await this.audioSubject.attach(username, observerProxy);
    console.log('   ✅ REGISTRADO en servidor como:', username);
    
    // ========================================
    // PASO 7: INICIAR POLLING (fallback)
    // ========================================
    console.log('   🔄 Iniciando polling (fallback)...');
    this.startAudioPolling(username);
    
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ SISTEMA DE LLAMADAS ACTIVO        ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('   📡 Observer escuchando callbacks');
    console.log('   🔄 Polling activo (fallback)');
    console.log('');
    
    return this.audioSubject;
    
  } catch (error) {
    console.error('❌ [AUDIO] Error fatal:', error);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

}

// Exportar instancia única
export const iceClient = new IceClientManager();
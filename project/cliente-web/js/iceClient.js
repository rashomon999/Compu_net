// ============================================
// js/iceClient.js - Cliente ICE con conversión de enums
// ============================================

// ✅ Importar ChatSystem
import './generated/ChatSystem.js';

// ✅ Función auxiliar para esperar a que Ice.js esté disponible
function waitForIce(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkIce = () => {
      if (typeof window.Ice !== 'undefined') {
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
    this.callService = null;
    this.isConnected = false;
    this.notificationAdapter = null;
    this.callAdapter = null;
    this.username = null;
    this.serverHost = 'localhost';
    this.serverPort = 10000;
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
        throw new Error('Ice.js no se cargó. Asegúrate de incluir <script src="https://unpkg.com/ice@3.7.10/lib/Ice.min.js"></script> en tu HTML ANTES del bundle.js');
      }
      
      console.log('✅ Ice.js detectado, versión:', Ice.stringVersion());
      
      if (!Ice.ChatSystem) {
        console.error('❌ Ice.ChatSystem no está disponible');
        throw new Error('ChatSystem.js no se cargó correctamente. Verifica que esté en js/generated/');
      }
      
      console.log('✅ ChatSystem cargado:', Object.keys(Ice.ChatSystem));
      
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
  // NOTIFICACIONES EN TIEMPO REAL
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
      
      // ✅ Usar adapter sin endpoint (solo local)
      if (!this.notificationAdapter) {
        this.notificationAdapter = await this.communicator.createObjectAdapter("");
        await this.notificationAdapter.activate();
        console.log('   ✅ Notification adapter creado (local)');
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

  // ========================================================================
  // LLAMADAS CON POLLING
  // ========================================================================

  async initiateCall(caller, callee, callType, sdp) {
    if (!this.callService) {
      throw new Error('CallService no disponible');
    }
    try {
      console.log('📤 [ICE] Enviando initiateCall:', { caller, callee, callType });
      const result = await this.callService.initiateCall(caller, callee, callType, sdp);
      console.log('📥 [ICE] Respuesta de initiateCall:', result);
      return result;
    } catch (error) {
      console.error('❌ [ICE] Error en initiateCall:', error);
      throw error;
    }
  }

  // ⚡ CRÍTICO: Convertir string a enum de CallStatus
  async answerCall(callId, callee, status, sdp) {
    if (!this.callService) {
      throw new Error('CallService no disponible');
    }
    try {
      const Ice = window.Ice;
      
      // ⚡ CRÍTICO: Convertir string a enum de CallStatus
      let callStatus;
      if (typeof status === 'string') {
        // Mapear strings a enums de Ice.js
        const statusMap = {
          'RINGING': Ice.ChatSystem.CallStatus.Ringing,
          'ACCEPTED': Ice.ChatSystem.CallStatus.Accepted,
          'REJECTED': Ice.ChatSystem.CallStatus.Rejected,
          'ENDED': Ice.ChatSystem.CallStatus.Ended,
          'BUSY': Ice.ChatSystem.CallStatus.Busy,
          'NO_ANSWER': Ice.ChatSystem.CallStatus.NoAnswer
        };
        callStatus = statusMap[status.toUpperCase()];
        
        if (!callStatus) {
          console.error('❌ Status inválido:', status);
          throw new Error('Status de llamada inválido: ' + status);
        }
        
        console.log('🔄 [ICE] Convertido status:', status, '→', callStatus._name, '(value:', callStatus._value + ')');
      } else {
        callStatus = status; // Ya es un enum
      }
      
      console.log('📤 [ICE] Enviando answerCall con status:', callStatus._name);
      return await this.callService.answerCall(callId, callee, callStatus, sdp);
    } catch (error) {
      console.error('❌ [ICE] Error respondiendo llamada:', error);
      throw error;
    }
  }

  async endCall(callId, username) {
    if (!this.callService) {
      throw new Error('CallService no disponible');
    }
    try {
      await this.callService.endCall(callId, username);
    } catch (error) {
      console.error('Error finalizando llamada:', error);
      throw error;
    }
  }

  async sendRtcCandidate(callId, username, candidate, sdpMid, sdpMLineIndex) {
    if (!this.callService) {
      throw new Error('CallService no disponible');
    }
    try {
      await this.callService.sendRtcCandidate(callId, username, candidate, sdpMid, sdpMLineIndex);
    } catch (error) {
      console.error('Error enviando RTC candidate:', error);
      throw error;
    }
  }

  async subscribeToCallEvents(username, callbacks) {
    if (!this.callService) {
      console.warn('⚠️ CallService no disponible');
      return;
    }
    
    try {
      console.log('📞 Suscribiendo a eventos de llamadas con POLLING...');
      console.log('   Usuario:', username);
      
      const Ice = window.Ice;
      
      // ✅ Usar adapter local (sin endpoint)
      if (!this.callAdapter) {
        this.callAdapter = await this.communicator.createObjectAdapter("");
        await this.callAdapter.activate();
        console.log('   ✅ Call adapter creado (local)');
      }
      
      const identity = Ice.generateUUID();
      console.log('   🆔 Identity generado:', identity);
      
      // Crear callback object
      const callbackObj = {
        onIncomingCall: (offer) => {
          console.log('🔔 [CALLBACK] onIncomingCall ejecutado!');
          console.log('   Offer:', offer);
          if (callbacks.onIncomingCall) {
            callbacks.onIncomingCall(offer);
          }
        },
        
        onCallAnswer: (answer) => {
          console.log('🔔 [CALLBACK] onCallAnswer ejecutado!');
          if (callbacks.onCallAnswer) {
            callbacks.onCallAnswer(answer);
          }
        },
        
        onRtcCandidate: (candidate) => {
          console.log('🔔 [CALLBACK] onRtcCandidate ejecutado');
          if (callbacks.onRtcCandidate) {
            callbacks.onRtcCandidate(candidate);
          }
        },
        
        onCallEnded: (callId, reason) => {
          console.log('🔔 [CALLBACK] onCallEnded ejecutado');
          if (callbacks.onCallEnded) {
            callbacks.onCallEnded(callId, reason);
          }
        }
      };
      
      const callbackProxy = this.callAdapter.add(
        new Ice.ChatSystem.CallCallback(callbackObj),
        new Ice.Identity(identity, "")
      );
      
      console.log('   📝 Proxy string:', callbackProxy.toString());
      console.log('   📤 Enviando suscripción al servidor...');
      
      await this.callService.subscribe(
        username,
        Ice.ChatSystem.CallCallbackPrx.uncheckedCast(callbackProxy)
      );
      
      console.log('✅ Suscrito a eventos de llamadas');
      
      // ✅ SOLUCIÓN TEMPORAL: Implementar polling para llamadas
      console.warn('⚠️ Usando POLLING para llamadas (callbacks bidireccionales no soportados en browser)');
      this._startCallPolling(username, callbacks);
      
    } catch (error) {
      console.error('❌ Error suscribiéndose a llamadas:', error);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * ✅ SOLUCIÓN: Polling para detectar llamadas entrantes
   */
  _startCallPolling(username, callbacks) {
    if (this.callPollingInterval) {
      clearInterval(this.callPollingInterval);
    }
    
    console.log('🔄 [POLLING] Iniciando polling para:', username);
    
    // Polling cada 1 segundo
    this.callPollingInterval = setInterval(async () => {
      try {
        console.log('🔍 [POLLING] Consultando llamadas pendientes...');
        
        // Obtener llamadas pendientes
        const incomingCalls = await this.callService.getPendingIncomingCalls(username);
        console.log('📬 [POLLING] Llamadas recibidas:', incomingCalls ? incomingCalls.length : 0);
        
        if (incomingCalls && incomingCalls.length > 0) {
          console.log('📞 [POLLING] ¡LLAMADA DETECTADA!', incomingCalls);
          for (const offer of incomingCalls) {
            console.log('📞 [POLLING] Procesando llamada de:', offer.caller);
            if (callbacks.onIncomingCall) {
              callbacks.onIncomingCall(offer);
            }
          }
        }
        
        // Obtener respuestas pendientes
        const answers = await this.callService.getPendingCallAnswers(username);
        if (answers && answers.length > 0) {
          console.log('📬 [POLLING] Respuestas pendientes:', answers.length);
          for (const answer of answers) {
            if (callbacks.onCallAnswer) {
              callbacks.onCallAnswer(answer);
            }
          }
        }
        
        // Obtener candidates pendientes
        const candidates = await this.callService.getPendingRtcCandidates(username);
        if (candidates && candidates.length > 0) {
          console.log('🧊 [POLLING] Candidates pendientes:', candidates.length);
          for (const candidate of candidates) {
            if (callbacks.onRtcCandidate) {
              callbacks.onRtcCandidate(candidate);
            }
          }
        }
        
      } catch (error) {
        console.error('❌ [POLLING] Error:', error);
      }
    }, 1000);
    
    console.log('✅ [POLLING] Polling activo (cada 1 segundo)');
  }
  
  async unsubscribeFromCallEvents(username) {
    if (!this.callService) return;
    try {
      if (this.callPollingInterval) {
        clearInterval(this.callPollingInterval);
        this.callPollingInterval = null;
      }
      await this.callService.unsubscribe(username);
      console.log('🔕 Desuscrito de eventos de llamadas');
    } catch (error) {
      console.error('Error desuscribiéndose de llamadas:', error);
    }
  }

  // ========================================================================
  // UTILIDADES
  // ========================================================================

  async disconnect() {
    if (this.username && this.notificationService) {
      await this.unsubscribeFromNotifications(this.username);
    }
    
    if (this.username && this.callService) {
      await this.unsubscribeFromCallEvents(this.username);
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

// Exportar instancia única
export const iceClient = new IceClientManager();
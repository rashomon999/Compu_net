// ============================================================================
// js/iceClient.js - UNIFICADO, COMPLETO y CORREGIDO
// Contiene: Chat, Groups, Notifications, Voice, Call, AudioSubject (observer)
// - Usa addWithUUID / createObjectAdapter / activate
// - Registra NotificationCallbackPrx y AudioObserverPrx correctamente
// - Provee wrappers usados por el frontend
// ============================================================================

class IceClientManager {
  constructor() {
    this.communicator = null;

    // Servicios ICE
    this.chatService = null;
    this.groupService = null;
    this.notificationService = null;
    this.voiceService = null;
    this.callService = null;

    // Estado de conexión
    this.username = null;
    this.serverHost = "localhost";
    this.serverPort = 10000;
    this.isConnected = false;

    // Notificaciones
    this.notificationAdapter = null;
    this.notificationCallbackPrx = null;

    // Audio
    this.audioSubject = null;
    this.audioAdapter = null;
    this.audioCallbacks = null;
    this.audioPollingInterval = null;
  }

  // ---------------------------
  // Config server
  // ---------------------------
  getServerConfig() {
    const savedHost = localStorage.getItem("serverHost");
    const savedPort = localStorage.getItem("serverPort");
    return {
      host: savedHost || "localhost",
      port: savedPort ? parseInt(savedPort) : 10000,
    };
  }

  saveServerConfig(host, port) {
    localStorage.setItem("serverHost", host);
    localStorage.setItem("serverPort", port.toString());
  }

  // ---------------------------
  // Conexión principal
  // ---------------------------
  async connect(username, serverHost = null, serverPort = null) {
    try {
      const Ice = window.Ice;
      if (!Ice) throw new Error("Ice.js no está disponible");

      const cfg = this.getServerConfig();
      this.serverHost = serverHost || cfg.host;
      this.serverPort = serverPort || cfg.port;
      this.username = username;

      console.log(`🔌 Conectando a ICE: ws://${this.serverHost}:${this.serverPort}`);

      const initData = new Ice.InitializationData();
      initData.properties = Ice.createProperties([
        ["Ice.Default.Protocol", "ws"],
        ["Ice.Default.Host", this.serverHost],
        ["Ice.Default.Port", this.serverPort.toString()],
      ]);

      this.communicator = Ice.initialize(initData);
      console.log("✅ Communicator inicializado");

      // Conectar a servicios
      await this.connectToServices(this.serverHost, this.serverPort);

      this.saveServerConfig(this.serverHost, this.serverPort);

      this.isConnected = true;
      console.log("✅ Conectado exitosamente a servidor ICE");
      return true;
    } catch (err) {
      console.error("❌ Error conectando a ICE:", err);
      this.isConnected = false;
      throw err;
    }
  }

  // ---------------------------
  // Conexión a servicios ICE
  // ---------------------------
  async connectToServices(host, port) {
    try {
      const Ice = window.Ice;
      console.log("📡 Conectando servicios...");

      // ChatService (obligatorio)
      {
        const chatProxy = this.communicator.stringToProxy(`ChatService:ws -h ${host} -p ${port}`);
        this.chatService = await Ice.ChatSystem.ChatServicePrx.checkedCast(chatProxy);
        if (!this.chatService) throw new Error("ChatService proxy retornó null");
        console.log("  ✅ ChatService conectado");
      }

      // GroupService (obligatorio)
      {
        const groupProxy = this.communicator.stringToProxy(`GroupService:ws -h ${host} -p ${port}`);
        this.groupService = await Ice.ChatSystem.GroupServicePrx.checkedCast(groupProxy);
        if (!this.groupService) throw new Error("GroupService proxy retornó null");
        console.log("  ✅ GroupService conectado");
      }

      // NotificationService (opcional)
      try {
        const notifProxy = this.communicator.stringToProxy(`NotificationService:ws -h ${host} -p ${port}`);
        this.notificationService = await Ice.ChatSystem.NotificationServicePrx.checkedCast(notifProxy);
        console.log("  ✅ NotificationService conectado");
      } catch (err) {
        console.warn("  ⚠️ NotificationService no disponible");
        this.notificationService = null;
      }

      // VoiceService (opcional)
      try {
        const voiceProxy = this.communicator.stringToProxy(`VoiceService:ws -h ${host} -p ${port}`);
        this.voiceService = await Ice.ChatSystem.VoiceServicePrx.checkedCast(voiceProxy);
        console.log("  ✅ VoiceService conectado");
      } catch (err) {
        console.warn("  ⚠️ VoiceService no disponible");
        this.voiceService = null;
      }

      // CallService (opcional)
      try {
        const callProxy = this.communicator.stringToProxy(`CallService:ws -h ${host} -p ${port}`);
        this.callService = await Ice.ChatSystem.CallServicePrx.checkedCast(callProxy);
        console.log("  ✅ CallService conectado");
      } catch (err) {
        console.warn("  ⚠️ CallService no disponible");
        this.callService = null;
      }

      console.log("✅ Servicios conectados exitosamente");
    } catch (error) {
      console.error("❌ Error conectando servicios:", error);
      throw error;
    }
  }

  // ---------------------------
  // Registrar callbacks de notificaciones
  // ---------------------------
  async registerNotificationCallbacks() {
    // Usa import dinámico para evitar ciclo con módulos que usan iceClient
    const Ice = window.Ice;
    console.log("🔔 Registrando callbacks de notificaciones...");

    // Crear adaptador si no existe
    if (!this.notificationAdapter) {
      this.notificationAdapter = await this.communicator.createObjectAdapter("");
    }

    // Importar subscriber (debe exportar default o clase NotificationSubscriber)
    let NotificationSubscriber;
    try {
      const mod = await import("./notificationsSubscriber.js");
      NotificationSubscriber = mod.default || mod.NotificationSubscriber || mod;
    } catch (err) {
      console.warn("   ⚠️ No se pudo importar notificationsSubscriber.js:", err);
      throw err;
    }

    const notifSubscriber = new NotificationSubscriber();

    // Registrar y crear proxy
    const notifProxy = this.notificationAdapter.addWithUUID(notifSubscriber);
    this.notificationCallbackPrx = await Ice.ChatSystem.NotificationCallbackPrx.uncheckedCast(notifProxy);

    // activar adaptador si no activo
    await this.notificationAdapter.activate();

    console.log("  ✅ NotificationCallbackPrx creado y adaptador activado");
  }

  // ---------------------------
  // Connect to AudioSubject (calls & audio streaming)
  // ---------------------------
  async connectToAudioSubject(host, port, username, observerCallbacks) {
    try {
      const Ice = window.Ice;
      console.log("📞 [AUDIO] Conectando a AudioSubject...");
      console.log("   Host:", host, "Port:", port, "Username:", username);

      if (!Ice || !Ice.AudioSystem) throw new Error("AudioSystem no está disponible");

      // PASO: crear proxy al AudioService
      const audioProxyString = `AudioService:ws -h ${host} -p ${port}`;
      const audioProxy = this.communicator.stringToProxy(audioProxyString);
      this.audioSubject = await Ice.AudioSystem.AudioSubjectPrx.checkedCast(audioProxy);

      if (!this.audioSubject) throw new Error("No se pudo conectar a AudioService - checkedCast retornó null");

      console.log("   ✅ AudioSubject conectado");

      // Guardar callbacks
      this.audioCallbacks = observerCallbacks;

      // Crear adaptador de audio
      if (!this.audioAdapter) {
        this.audioAdapter = await this.communicator.createObjectAdapter("");
        console.log("   ✅ Adaptador creado");
      }

      // Importar subscriber (Audio observer)
      const { default: AudioSubscriber } = await import("./subscriber.js");
      const subscriber = new AudioSubscriber({ audioCallbacks: observerCallbacks });

      // Agregar observer y obtener proxy
      const observerProxy = this.audioAdapter.addWithUUID(subscriber);
      console.log("   ✅ Observer registrado en adaptador");

      // Activar adaptador
      await this.audioAdapter.activate();
      console.log("   ✅ Adaptador activado");

      // Registrarse en el servidor
      await this.audioSubject.attach(username, observerProxy);
      console.log("   ✅ Registrado en servidor como:", username);

      // Iniciar polling fallback
      this.startAudioPolling(username);

      console.log("✅ Sistema de llamadas ACTIVO (callbacks + polling)");
      return this.audioSubject;
    } catch (error) {
      console.error("❌ [AUDIO] Error conectando AudioSubject:", error);
      throw error;
    }
  }

  // ---------------------------
  // Polling de audio (fallback)
  // ---------------------------
  startAudioPolling(username) {
    if (!this.audioSubject) {
      console.warn("⚠️ startAudioPolling: audioSubject no inicializado");
      return;
    }

    if (this.audioPollingInterval) {
      clearInterval(this.audioPollingInterval);
    }

    console.log("🔄 [AUDIO POLLING] Iniciando para:", username);

    this.audioPollingInterval = setInterval(async () => {
      try {
        // incoming
        const incomingCalls = await this.audioSubject.getPendingIncomingCalls(username);
        if (incomingCalls && incomingCalls.length > 0) {
          for (const fromUser of incomingCalls) {
            this.audioCallbacks?.incomingCall?.(fromUser);
          }
        }

        // accepted
        const acceptedCalls = await this.audioSubject.getPendingAcceptedCalls(username);
        if (acceptedCalls && acceptedCalls.length > 0) {
          for (const fromUser of acceptedCalls) {
            this.audioCallbacks?.callAccepted?.(fromUser);
          }
        }

        // rejected
        const rejectedCalls = await this.audioSubject.getPendingRejectedCalls(username);
        if (rejectedCalls && rejectedCalls.length > 0) {
          for (const fromUser of rejectedCalls) {
            this.audioCallbacks?.callRejected?.(fromUser);
          }
        }

        // ended
        const endedCalls = await this.audioSubject.getPendingEndedCalls(username);
        if (endedCalls && endedCalls.length > 0) {
          for (const fromUser of endedCalls) {
            this.audioCallbacks?.callEnded?.(fromUser);
          }
        }
      } catch (err) {
        // Silenciar algunos errores de polling
        if (!err.message?.includes("timeout")) console.error("❌ [AUDIO POLLING] Error:", err);
      }
    }, 1000);

    console.log("✅ [AUDIO POLLING] Polling activo");
  }

  // ---------------------------
  // Desconectar AudioSubject
  // ---------------------------
  async disconnectFromAudioSubject(username) {
    if (this.audioPollingInterval) {
      clearInterval(this.audioPollingInterval);
      this.audioPollingInterval = null;
    }

    try {
      if (this.audioSubject && username) {
        await this.audioSubject.detach(username);
        console.log("👋 Desconectado de AudioSubject:", username);
      }
    } catch (err) {
      console.warn("⚠️ Error en detach:", err);
    }

    try {
      if (this.audioAdapter) {
        await this.audioAdapter.destroy();
        this.audioAdapter = null;
      }
    } catch (err) {
      console.warn("⚠️ Error destruyendo audioAdapter:", err);
    }

    this.audioSubject = null;
    this.audioCallbacks = null;
  }

  // ---------------------------
  // Suscripciones a notificaciones públicas (wrapper)
  // ---------------------------
  async subscribeToNotifications(username) {
    if (!this.notificationService) {
      console.warn("⚠️ subscribeToNotifications: NotificationService no disponible");
      return;
    }
    if (!this.notificationCallbackPrx) {
      // Registrar callbacks si no existen
      await this.registerNotificationCallbacks();
    }
    try {
      await this.notificationService.subscribe(username, this.notificationCallbackPrx);
      console.log("✅ Suscrito a notificaciones:", username);
    } catch (err) {
      console.error("❌ Error suscribiéndose a notificaciones:", err);
      throw err;
    }
  }

  async unsubscribeFromNotifications(username) {
    if (!this.notificationService) return;
    try {
      await this.notificationService.unsubscribe(username);
      console.log("📕 Desuscrito de notificaciones:", username);
    } catch (err) {
      console.warn("⚠️ Error desuscribiéndose:", err);
    }
  }

  // ---------------------------
  // Cleanup / disconnect
  // ---------------------------
  async disconnect() {
    // Unsubscribe notifs
    try {
      if (this.username && this.notificationService) {
        await this.unsubscribeFromNotifications(this.username);
      }
    } catch (err) { /* ignore */ }

    // Audio detach
    try {
      if (this.username && this.audioSubject) {
        await this.disconnectFromAudioSubject(this.username);
      }
    } catch (err) { /* ignore */ }

    // Destroy adapters
    try {
      if (this.notificationAdapter) {
        await this.notificationAdapter.destroy();
        this.notificationAdapter = null;
      }
    } catch (err) { /* ignore */ }

    // Destroy communicator
    try {
      if (this.communicator) {
        await this.communicator.destroy();
        this.communicator = null;
      }
    } catch (err) { /* ignore */ }

    this.isConnected = false;
    console.log("👋 Desconectado de ICE");
  }

  // ---------------------------
  // Wrappers usados por frontend
  // ---------------------------
  async getRecentConversations(user) {
    if (!this.chatService) throw new Error("ChatService no disponible");
    return this.chatService.getRecentConversations(user);
  }

  async listUserGroups(user) {
    if (!this.groupService) throw new Error("GroupService no disponible");
    return this.groupService.listUserGroups(user);
  }

  // Exporta también métodos directos si quieres
  isClientConnected() {
    return this.isConnected;
  }

  // ---------------------------
  // Wrappers RESTAURADOS
  // ---------------------------

  async getConversationHistory(user, withUser) {
    if (!this.chatService) throw new Error("ChatService no disponible");
    return this.chatService.getConversationHistory(user, withUser);
  }

  async sendMessage(from, to, message) {
    if (!this.chatService) throw new Error("ChatService no disponible");
    return this.chatService.sendMessage(from, to, message);
  }

  async getUserStatus(user) {
    if (!this.chatService) throw new Error("ChatService no disponible");
    return this.chatService.getUserStatus(user);
  }

  async getGroupInfo(groupName) {
    if (!this.groupService) throw new Error("GroupService no disponible");
    return this.groupService.getGroupInfo(groupName);
  }

  async createGroup(groupName, creator) {
    if (!this.groupService) throw new Error("GroupService no disponible");
    return this.groupService.createGroup(groupName, creator);
  }

  async addUserToGroup(groupName, username) {
    if (!this.groupService) throw new Error("GroupService no disponible");
    return this.groupService.addUserToGroup(groupName, username);
  }

  async removeUserFromGroup(groupName, username) {
    if (!this.groupService) throw new Error("GroupService no disponible");
    return this.groupService.removeUserFromGroup(groupName, username);
  }

  async getRecentConversations(user) {
    if (!this.chatService) throw new Error("ChatService no disponible");
    return this.chatService.getRecentConversations(user);
  }

  async listUserGroups(user) {
    if (!this.groupService) throw new Error("GroupService no disponible");
    return this.groupService.listUserGroups(user);
  }

  
}

// Exportar instancia
export const iceClient = new IceClientManager();

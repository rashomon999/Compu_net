// ============================================================================
// js/iceClient.js - VERSIÓN FINAL, LIMPIA Y CORREGIDA
// NO DUPLICA MÉTODOS - NO USA setAdapter - CALLBACKS SE REGISTRAN CORRECTAMENTE
// ============================================================================

class IceClientManager {
  constructor() {
    this.communicator = null;
    this.chatService = null;
    this.groupService = null;
    this.notificationService = null;
    this.voiceService = null;
    this.callService = null;

    this.isConnected = false;
    this.username = null;
    this.serverHost = "localhost";
    this.serverPort = 10000;

    this.notificationAdapter = null;

    // Audio
    this.audioSubject = null;
    this.audioAdapter = null;
    this.audioCallbacks = null;
    this.audioPollingInterval = null;
  }

  // ================================================================
  // CONEXIÓN BASE
  // ================================================================
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

  async connect(username, serverHost = null, serverPort = null) {
    try {
      const config = this.getServerConfig();
      this.serverHost = serverHost || config.host;
      this.serverPort = serverPort || config.port;

      console.log(`🔌 Conectando a ICE: ws://${this.serverHost}:${this.serverPort}`);

      const Ice = window.Ice;
      if (!Ice) throw new Error("Ice.js no está cargado");

      if (!Ice.ChatSystem) throw new Error("ChatSystem no inicializado");
      if (!Ice.AudioSystem) console.warn("⚠ AudioSystem no inicializado aún");

      this.username = username;

      const init = new Ice.InitializationData();
      init.properties = Ice.createProperties([
        ["Ice.Default.Protocol", "ws"],
        ["Ice.Default.Host", this.serverHost],
        ["Ice.Default.Port", this.serverPort.toString()],
      ]);

      this.communicator = Ice.initialize(init);

      await this.connectToServices(this.serverHost, this.serverPort);

      this.saveServerConfig(this.serverHost, this.serverPort);

      this.isConnected = true;
      console.log("✅ Conexión ICE establecida");

      return true;
    } catch (err) {
      console.error("❌ Error conectando:", err);
      this.isConnected = false;
      throw err;
    }
  }

  // ================================================================
  // SERVICIOS ICE
  // ================================================================
  async connectToServices(host, port) {
    const Ice = window.Ice;

    console.log("📡 Conectando servicios...");

    // -- ChatService
    {
      const proxy = this.communicator.stringToProxy(`ChatService:ws -h ${host} -p ${port}`);
      this.chatService = await Ice.ChatSystem.ChatServicePrx.checkedCast(proxy);
      if (!this.chatService) throw new Error("ChatService es null");
      console.log("  ✓ ChatService conectado");
    }

    // -- GroupService
    {
      const proxy = this.communicator.stringToProxy(`GroupService:ws -h ${host} -p ${port}`);
      this.groupService = await Ice.ChatSystem.GroupServicePrx.checkedCast(proxy);
      if (!this.groupService) throw new Error("GroupService es null");
      console.log("  ✓ GroupService conectado");
    }

    // -- Notificaciones
    try {
      const proxy = this.communicator.stringToProxy(`NotificationService:ws -h ${host} -p ${port}`);
      this.notificationService = await Ice.ChatSystem.NotificationServicePrx.checkedCast(proxy);
      console.log("  ✓ NotificationService conectado");
    } catch {
      console.warn("  ⚠ NotificationService no disponible");
      this.notificationService = null;
    }

    // -- Voice (opcional)
    try {
      const proxy = this.communicator.stringToProxy(`VoiceService:ws -h ${host} -p ${port}`);
      this.voiceService = await Ice.ChatSystem.VoiceServicePrx.checkedCast(proxy);
      console.log("  ✓ VoiceService conectado");
    } catch {
      console.warn("  ⚠ VoiceService no disponible");
      this.voiceService = null;
    }

    // -- Calls (opcional)
    try {
      const proxy = this.communicator.stringToProxy(`CallService:ws -h ${host} -p ${port}`);
      this.callService = await Ice.ChatSystem.CallServicePrx.checkedCast(proxy);
      console.log("  ✓ CallService conectado");
    } catch {
      console.warn("  ⚠ CallService no disponible");
      this.callService = null;
    }

    console.log("✅ Todos los servicios listos");
  }

  // ================================================================
  // AUDIO SYSTEM (VERSIÓN FINAL)
  // ================================================================
  async connectToAudioSubject(host, port, username, observerCallbacks) {
    try {
      console.log("📞 Conectando AudioSubject…");

      const Ice = window.Ice;

      // 1. Conectar al servidor
      const proxyString = `AudioService:ws -h ${host} -p ${port}`;
      const audioProxy = this.communicator.stringToProxy(proxyString);
      this.audioSubject = await Ice.AudioSystem.AudioSubjectPrx.checkedCast(audioProxy);

      if (!this.audioSubject) throw new Error("AudioSubject es null");

      console.log("  ✓ AudioSubject conectado");

      // 2. Guardar callbacks
      this.audioCallbacks = observerCallbacks;

      // 3. Crear adaptador (NINGÚN setAdapter AQUÍ)
      this.audioAdapter = await this.communicator.createObjectAdapter("");
      console.log("  ✓ Adaptador creado");

      // 4. Crear Observer (subscriber.js)
      const { default: AudioSubscriber } = await import("./subscriber.js");
      const subscriber = new AudioSubscriber({
        audioCallbacks: observerCallbacks,
      });

      // 5. Registrar Observer
      const observerProxy = this.audioAdapter.addWithUUID(subscriber);

      // 6. Activar adaptador
      await this.audioAdapter.activate();
      console.log("  ✓ Adaptador activado");

      // 7. Registrarse en el servidor
      await this.audioSubject.attach(username, observerProxy);
      console.log("  ✓ Registrado en servidor como", username);

      // 8. Iniciar Polling
      this.startAudioPolling(username);

      console.log("🎧 AudioSystem ACTIVO");
      return this.audioSubject;
    } catch (err) {
      console.error("❌ Error AudioSystem:", err);
      throw err;
    }
  }

  // ================================================================
  // AUDIO POLLING (fallback)
  // ================================================================
  startAudioPolling(username) {
    if (this.audioPollingInterval) clearInterval(this.audioPollingInterval);

    console.log("🔄 Audio polling iniciado");

    this.audioPollingInterval = setInterval(async () => {
      try {
        const pending = await this.audioSubject.getPendingIncomingCalls(username);
        for (const u of pending) this.audioCallbacks.incomingCall?.(u);

        const acc = await this.audioSubject.getPendingAcceptedCalls(username);
        for (const u of acc) this.audioCallbacks.callAccepted?.(u);

        const rej = await this.audioSubject.getPendingRejectedCalls(username);
        for (const u of rej) this.audioCallbacks.callRejected?.(u);

        const end = await this.audioSubject.getPendingEndedCalls(username);
        for (const u of end) this.audioCallbacks.callEnded?.(u);
      } catch {}
    }, 1000);
  }

  async disconnectFromAudioSubject(username) {
    if (this.audioPollingInterval) clearInterval(this.audioPollingInterval);

    try {
      await this.audioSubject?.detach(username);
    } catch {}

    try {
      await this.audioAdapter?.destroy();
    } catch {}

    this.audioSubject = null;
    this.audioCallbacks = null;
    this.audioAdapter = null;
  }

  // ================================================================
  // CLEANUP COMPLETO
  // ================================================================
  async disconnect() {
    if (this.username && this.notificationService) {
      await this.unsubscribeFromNotifications(this.username);
    }

    if (this.audioSubject) {
      await this.disconnectFromAudioSubject(this.username);
    }

    if (this.notificationAdapter) {
      await this.notificationAdapter.destroy();
      this.notificationAdapter = null;
    }

    if (this.communicator) {
      await this.communicator.destroy();
    }

    this.isConnected = false;
    console.log("👋 ICE desconectado");
  }

  isClientConnected() {
    return this.isConnected;
  }
}

// ================================================================
// EXPORT
// ================================================================
export const iceClient = new IceClientManager();

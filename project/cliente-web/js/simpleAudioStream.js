// ============================================
// js/simpleAudioStream.js - Audio Streaming CORREGIDO
// ✅ SIGUIENDO EXACTAMENTE EL ENFOQUE DEL PROFESOR
// ============================================

class SimpleAudioStreamManager {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.isStreaming = false;
    this.sendBuffer = [];
    this.receiveQueue = [];
    this.isPlaying = false;
    this.gainNode = null;
    this.isMuted = false;
    this.audioSubject = null;
    this.username = null;
    
    // ✅ CRÍTICO: REPRODUCTOR DEDICADO (como el profesor)
    this.playerThread = null;
    this.speakerSource = null;
    
    console.log('🎵 [SIMPLE AUDIO] Inicializado');
  }
  
  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;
    console.log('✅ [SIMPLE AUDIO] AudioSubject configurado para:', username);
  }
  
  // ========================================
  // ✅ PASO 1: INICIALIZAR REPRODUCTOR (COMO EL PROFESOR)
  // ========================================
  
  async initializePlayerThread() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100
        });
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // ✅ Crear SourceDataLine equivalente (speakers)
      // En el navegador es directamente el AudioContext destination
      this.playerThread = {
        isPlaying: true,
        queue: [],
        isProcessing: false
      };
      
      console.log('   ✅ PlayerThread inicializado');
      return true;
      
    } catch (error) {
      console.error('❌ Error inicializando PlayerThread:', error);
      throw error;
    }
  }
  
  // ========================================
  // ✅ PASO 2: INICIAR CAPTURA (COMO EL PROFESOR)
  // ========================================
  
  async startStreaming() {
    try {
      console.log('🎤 [SIMPLE AUDIO] Iniciando captura...');
      
      if (!this.audioSubject || !this.username) {
        throw new Error('AudioSubject no configurado');
      }
      
      // Inicializar reproductor primero
      await this.initializePlayerThread();
      
      // Crear AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100
        });
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('   AudioContext creado: 44.1kHz');
      
      // Solicitar micrófono
      console.log('   Solicitando micrófono...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });
      
      console.log('   ✅ Micrófono accedido');
      
      // ========================================
      // ✅ PIPELINE DE AUDIO (EXACTO DEL PROFESOR)
      // ========================================
      
      // PASO 1: Input desde micrófono
      const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // PASO 2: Ganancia (volumen)
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.5; // 50% volumen (como el profesor)
      
      // PASO 3: ScriptProcessor (2048 = ~46ms latencia)
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      // PASO 4: Conectar
      audioInput.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // ========================================
      // ✅ HANDLER DE PROCESAMIENTO (EXACTO DEL PROFESOR)
      // ========================================
      
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isStreaming) return;
        
        // PASO 1: Obtener datos Float32
        const input = e.inputBuffer.getChannelData(0);
        
        // PASO 2: Aplicar compresión suave
        const compressed = this.applySoftCompression(input);
        
        // PASO 3: Convertir a PCM16
        const pcm16 = this.floatToPCM16(compressed);
        
        // PASO 4: Acumular en buffer
        this.sendBuffer.push(pcm16);
        
        // PASO 5: Enviar cuando hay suficientes chunks (8 chunks)
        if (this.sendBuffer.length >= 8) {
          const merged = this.mergePCM(this.sendBuffer);
          this.sendBuffer = [];
          
          // Enviar al servidor SIN BLOQUEAR
          this.sendAudioToServer(new Uint8Array(merged.buffer));
        }
      };
      
      this.isStreaming = true;
      console.log('✅ [SIMPLE AUDIO] Captura ACTIVA');
      
      return true;
      
    } catch (error) {
      console.error('❌ [SIMPLE AUDIO] Error:', error);
      throw error;
    }
  }
  
  // ========================================
  // ✅ ENVIAR AUDIO AL SERVIDOR
  // ========================================
  
  async sendAudioToServer(audioData) {
    try {
      if (!this.isStreaming || !this.audioSubject) return;
      
      // Enviar via Ice (ASÍNCRONO, NO BLOQUEA)
      await this.audioSubject.sendAudio(this.username, audioData);
      
    } catch (error) {
      // Silenciar errores de timeout
      if (!error.message.includes('timeout')) {
        console.warn('⚠️ [SIMPLE AUDIO] Error enviando:', error.message);
      }
    }
  }
  
  // ========================================
  // ✅ RECIBIR Y REPRODUCIR (COMO EL PROFESOR)
  // ========================================
  
  async receiveAudioChunk(audioData) {
    try {
      // Validar AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100
        });
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Convertir PCM16 a Float32
      const floatArray = this.convertPCM16ToFloat32(audioData);
      
      // Agregar a la cola
      if (this.playerThread) {
        this.playerThread.queue.push(floatArray);
      }
      
      // Iniciar reproducción si no está corriendo
      if (!this.isPlaying && this.playerThread && this.playerThread.isPlaying) {
        this.processReceiveQueue();
      }
      
    } catch (error) {
      console.error('❌ [SIMPLE AUDIO] Error recibiendo:', error);
    }
  }
  
  // ========================================
  // ✅ PROCESAR COLA DE REPRODUCCIÓN (COMO PLAYERTHREAD)
  // ========================================
  
  processReceiveQueue() {
    if (!this.playerThread || this.playerThread.queue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    
    // Extraer siguiente buffer
    const data = this.playerThread.queue.shift();
    
    if (!data) {
      this.isPlaying = false;
      return;
    }
    
    // Crear AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, data.length, 44100);
    audioBuffer.getChannelData(0).set(data);
    
    // Crear source y reproducir
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.start();
    
    // Cuando termina, procesar el siguiente (recursivo como PlayerThread)
    source.onended = () => this.processReceiveQueue();
  }
  
  // ========================================
  // ✅ PROCESAMIENTO DE AUDIO (DEL PROFESOR)
  // ========================================
  
  applySoftCompression(buffer) {
    const threshold = 0.65;
    const ratio = 4.0;
    const out = new Float32Array(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      let v = buffer[i];
      if (Math.abs(v) > threshold) {
        v = Math.sign(v) * (threshold + (Math.abs(v) - threshold) / ratio);
      }
      out[i] = v;
    }
    
    return out;
  }
  
  mergePCM(chunks) {
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Int16Array(total);
    let offset = 0;
    
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    
    return merged;
  }
  
  floatToPCM16(float32) {
    const pcm16 = new Int16Array(float32.length);
    
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    
    return pcm16;
  }
  
  convertPCM16ToFloat32(byteArray) {
    const view = new DataView(byteArray.buffer);
    const floatBuffer = new Float32Array(byteArray.byteLength / 2);
    
    for (let i = 0; i < floatBuffer.length; i++) {
      floatBuffer[i] = view.getInt16(i * 2, true) / 32768;
    }
    
    return floatBuffer;
  }
  
  // ========================================
  // CONTROLES
  // ========================================
  
  stopStreaming() {
    console.log('🛑 [SIMPLE AUDIO] Deteniendo captura...');
    
    this.isStreaming = false;
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    this.sendBuffer = [];
    console.log('✅ [SIMPLE AUDIO] Captura detenida');
  }
  
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.5;
      console.log('🎤 [SIMPLE AUDIO]', muted ? 'SILENCIADO' : 'ACTIVO');
    }
  }
  
  cleanup() {
    console.log('🧹 [SIMPLE AUDIO] Limpiando...');
    
    this.stopStreaming();
    
    if (this.playerThread) {
      this.playerThread.isPlaying = false;
      this.playerThread.queue = [];
    }
    
    this.receiveQueue = [];
    this.isPlaying = false;
    this.isMuted = false;
    
    console.log('✅ [SIMPLE AUDIO] Limpieza completada');
  }
  
  isActive() {
    return this.isStreaming;
  }
}

export const simpleAudioStream = new SimpleAudioStreamManager();
// ============================================
// js/simpleAudioStream.js - Audio Streaming SIMPLIFICADO
// Filosofía del Profesor: PCM16 directo, sin WebRTC
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
    
    console.log('🎵 [SIMPLE AUDIO] Inicializado');
  }
  
  // ========================================
  // CONFIGURACIÓN INICIAL
  // ========================================
  
  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;
    console.log('✅ [SIMPLE AUDIO] AudioSubject configurado para:', username);
  }
  
  // ========================================
  // INICIAR CAPTURA DE AUDIO
  // ========================================
  
  async startStreaming() {
    try {
      console.log('🎤 [SIMPLE AUDIO] Iniciando captura...');
      
      if (!this.audioSubject || !this.username) {
        throw new Error('AudioSubject no configurado');
      }
      
      // Crear AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100
        });
        console.log('   AudioContext creado: 44.1kHz');
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
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
      
      // Crear pipeline de audio (IGUAL QUE EL PROFESOR)
      const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.5;
      
      // ScriptProcessor (2048 samples = ~46ms de latencia)
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      audioInput.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Handler de procesamiento (CRÍTICO)
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
        
        // PASO 5: Enviar cuando hay suficientes chunks
        if (this.sendBuffer.length >= 8) {
          const merged = this.mergePCM(this.sendBuffer);
          this.sendBuffer = [];
          
          // Enviar al servidor
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
  // DETENER CAPTURA
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
  
  // ========================================
  // ENVIAR AUDIO AL SERVIDOR
  // ========================================
  
  async sendAudioToServer(audioData) {
    try {
      if (!this.isStreaming || !this.audioSubject) return;
      
      // Enviar via Ice (método del profesor)
      await this.audioSubject.sendAudio(this.username, audioData);
      
    } catch (error) {
      // Silenciar errores de timeout
      if (!error.message.includes('timeout')) {
        console.warn('⚠️ [SIMPLE AUDIO] Error enviando:', error.message);
      }
    }
  }
  
  // ========================================
  // RECIBIR Y REPRODUCIR AUDIO
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
      this.receiveQueue.push(floatArray);
      
      // Iniciar reproducción si no está corriendo
      if (!this.isPlaying) {
        this.processReceiveQueue();
      }
      
    } catch (error) {
      console.error('❌ [SIMPLE AUDIO] Error recibiendo:', error);
    }
  }
  
  processReceiveQueue() {
    if (this.receiveQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    
    // Extraer siguiente buffer
    const data = this.receiveQueue.shift();
    
    // Crear AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, data.length, 44100);
    audioBuffer.getChannelData(0).set(data);
    
    // Crear source y reproducir
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.start();
    
    // Cuando termina, procesar el siguiente
    source.onended = () => this.processReceiveQueue();
  }
  
  // ========================================
  // PROCESAMIENTO DE AUDIO (DEL PROFESOR)
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
  
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.5;
      console.log('🎤 [SIMPLE AUDIO]', muted ? 'SILENCIADO' : 'ACTIVO');
    }
  }
  
  // ========================================
  // LIMPIAR
  // ========================================
  
  cleanup() {
    console.log('🧹 [SIMPLE AUDIO] Limpiando...');
    
    this.stopStreaming();
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
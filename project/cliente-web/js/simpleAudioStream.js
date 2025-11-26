//////////////////////////////////////////////////////////////
//  SIMPLE AUDIO STREAM MANAGER — VERSION CORREGIDA
//////////////////////////////////////////////////////////////

class SimpleAudioStreamManager {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.scriptProcessor = null;
        this.isStreaming = false;
        this.sendBuffer = [];
        this.playerThread = null;
        this.gainNode = null;
        this.isMuted = false;
        this.audioSubject = null;
        this.username = null;
    }

    setAudioSubject(audioSubject, username) {
        this.audioSubject = audioSubject;
        this.username = username;
    }

    async initializePlayerThread() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        }
        if (this.audioContext.state === "suspended") {
            await this.audioContext.resume();
        }

        if (!this.playerThread) {
            this.playerThread = {
                isAlive: true,
                isProcessing: false,
                queue: []
            };
        }
    }

    async startStreaming() {
        try {
            if (this.isStreaming) return;

            if (!this.audioSubject || !this.username) {
                throw new Error("AudioSubject o username no configurado");
            }

            await this.initializePlayerThread();

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            });

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 44100
                });
            }
            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);

            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.5;

            this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);

            audioInput.connect(this.gainNode);
            this.gainNode.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            this.scriptProcessor.onaudioprocess = (e) => {
                if (!this.isStreaming) return;

                const input = e.inputBuffer.getChannelData(0);
                const compressed = this.applySoftCompression(input);
                const pcm16 = this.floatToPCM16(compressed);
                this.sendBuffer.push(pcm16);

                if (this.sendBuffer.length >= 8) {
                    const merged = this.mergePCM(this.sendBuffer);
                    this.sendBuffer = [];
                    this.sendAudioToServer(new Uint8Array(merged.buffer)).catch(() => {});
                }
            };

            this.isStreaming = true;
        } catch (error) {
            this.stopStreaming();
            throw error;
        }
    }

    async sendAudioToServer(audioData) {
        if (!this.isStreaming || !this.audioSubject) return;
        try {
            await this.audioSubject.sendAudio(this.username, audioData);
        } catch (_) {}
    }

    async receiveAudioChunk(audioData) {
        if (!this.playerThread || !this.playerThread.isAlive) return;

        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 44100
                });
            }
            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            const floatArray = this.convertPCM16ToFloat32(audioData);

            this.playerThread.queue.push(floatArray);

            if (!this.playerThread.isProcessing) {
                this.processReceiveQueue();
            }
        } catch (_) {}
    }

    processReceiveQueue() {
        if (!this.playerThread || !this.playerThread.isAlive) return;

        if (this.playerThread.queue.length === 0) {
            this.playerThread.isProcessing = false;
            return;
        }

        this.playerThread.isProcessing = true;

        const data = this.playerThread.queue.shift();
        if (!data) {
            this.playerThread.isProcessing = false;
            return;
        }

        const audioBuffer = this.audioContext.createBuffer(1, data.length, 44100);
        audioBuffer.getChannelData(0).set(data);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start();

        source.onended = () => {
            if (this.playerThread && this.playerThread.isAlive) {
                this.processReceiveQueue();
            }
        };
    }

    stopStreaming() {
        this.isStreaming = false;

        if (this.scriptProcessor) {
            try { this.scriptProcessor.disconnect(); } catch (_) {}
            this.scriptProcessor = null;
        }

        if (this.mediaStream) {
            try {
                this.mediaStream.getTracks().forEach(t => t.stop());
            } catch (_) {}
            this.mediaStream = null;
        }

        this.sendBuffer = [];

        if (this.playerThread) {
            this.playerThread.isAlive = false;
            this.playerThread.queue = [];
            this.playerThread.isProcessing = false;
        }
    }

    cleanup() {
        this.stopStreaming();
        this.playerThread = null;  // <-- ahora es seguro porque isAlive=false detuvo las colas
        this.isMuted = false;
    }

    toggleMute(muted) {
        this.isMuted = muted;
        if (this.gainNode) {
            this.gainNode.gain.value = muted ? 0 : 0.5;
        }
    }

    isActive() {
        return this.isStreaming;
    }

    //////////////////////////////////////////////////////////////
    //  UTILIDADES (no se tocan)
    //////////////////////////////////////////////////////////////

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
        const output = new Float32Array(byteArray.byteLength / 2);
        for (let i = 0; i < output.length; i++) {
            output[i] = view.getInt16(i * 2, true) / 32768;
        }
        return output;
    }
}

export const simpleAudioStream = new SimpleAudioStreamManager();

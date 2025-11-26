import { simpleAudioStream } from "./simpleAudioStream.js";

class SimpleCallManager {
  constructor() {
    this.activeCall = null;
    this.ringTimer = null;
    this.callTimer = null;
    this.callStartTime = null;
    this.callDuration = 0;
    this.audioSubject = null;
    this.username = null;
  }

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;
    simpleAudioStream.setAudioSubject(audioSubject, username);
  }

  async initiateOutgoingCall(targetUser) {
    try {
      if (!this.audioSubject) throw new Error("AudioSubject no configurado");

      try {
        const connectedUsers = await this.audioSubject.getConnectedUsers();
        if (!connectedUsers.includes(targetUser)) {}
      } catch (_) {}

      this.activeCall = {
        type: "OUTGOING",
        callerId: this.username,
        calleeId: targetUser,
        startTime: Date.now(),
        status: "RINGING"
      };

      await this.audioSubject.startCall(this.username, targetUser);

      this.setupRingTimer();

      return true;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  async receiveIncomingCall(fromUser) {
    try {
      this.activeCall = {
        type: "INCOMING",
        callerId: fromUser,
        calleeId: this.username,
        startTime: Date.now(),
        status: "RINGING"
      };

      this.setupRingTimer();
      return this.activeCall;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async acceptCall() {
    try {
      if (!this.activeCall || this.activeCall.type !== "INCOMING") {
        throw new Error("No hay llamada entrante para aceptar");
      }

      this.clearRingTimer();

      await this.audioSubject.acceptCall(
        this.activeCall.callerId,
        this.username
      );

      await this.delay(200);

      if (!simpleAudioStream.isActive()) {
        await simpleAudioStream.startStreaming();
      }

      this.activeCall.status = "CONNECTED";
      this.activeCall.answerTime = Date.now();

      this.startDurationTimer();

      return true;
    } catch (error) {
      throw error;
    }
  }

  async handleCallAccepted() {
    try {
      this.clearRingTimer();

      if (this.activeCall) {
        this.activeCall.status = "CONNECTED";
        this.activeCall.answerTime = Date.now();
      }

      if (!simpleAudioStream.isActive()) {
        await simpleAudioStream.startStreaming();
      }

      this.startDurationTimer();
    } catch (error) {
      throw error;
    }
  }

  async rejectCall() {
    try {
      if (!this.activeCall) return;

      this.clearRingTimer();

      if (this.activeCall.type === "INCOMING") {
        await this.audioSubject.rejectCall(
          this.username,
          this.activeCall.callerId
        );
      }

      this.cleanup();
    } catch (_) {
      this.cleanup();
    }
  }

  async endCall() {
    try {
      if (!this.activeCall) return;

      const otherUser =
        this.activeCall.type === "OUTGOING"
          ? this.activeCall.calleeId
          : this.activeCall.callerId;

      this.clearAllTimers();
      simpleAudioStream.cleanup();

      try {
        await this.audioSubject.hangup(this.username, otherUser);

      } catch (_) {}

      this.cleanup();
    } catch (_) {
      this.cleanup();
    }
  }

  setupRingTimer() {
    this.ringTimer = setTimeout(async () => {
      if (this.activeCall && this.activeCall.type === "OUTGOING") {
        await this.endCall();
      } else if (this.activeCall && this.activeCall.type === "INCOMING") {
        await this.rejectCall();
      }
    }, 60000);
  }

  startDurationTimer() {
    this.callStartTime = Date.now();
    this.callDuration = 0;

    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor(
        (Date.now() - this.callStartTime) / 1000
      );
      if (window.updateCallDuration) {
        window.updateCallDuration(this.callDuration);
      }
    }, 1000);
  }

  clearRingTimer() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
  }

  clearCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  clearAllTimers() {
    this.clearRingTimer();
    this.clearCallTimer();
  }

  cleanup() {
    this.clearAllTimers();
    this.activeCall = null;
    this.callDuration = 0;
    this.callStartTime = null;
  }

  getActiveCall() {
    return this.activeCall;
  }

  isCallActive() {
    return this.activeCall && this.activeCall.status === "CONNECTED";
  }
}

export const simpleCallManager = new SimpleCallManager();

if (typeof window !== "undefined") {
  window._simpleCallManager = simpleCallManager;
}

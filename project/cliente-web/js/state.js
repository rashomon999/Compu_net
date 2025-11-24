// ============================================
// js/state.js - Estado global de la aplicación
// ============================================

export const state = {
  // Autenticación
  currentUsername: null,
  isLoggedIn: false,
  
  // Chat actual
  currentChat: null,
  isGroup: false,
  
  // Disponibilidad de servicios
  callsAvailable: true,  // ✅ Flag para trackear si CallService está disponible
  voiceNotesAvailable: true,
  
  // Polling
  pollingActive: false,
  lastMessageId: 0,
};

export function resetState() {
  state.currentUsername = null;
  state.isLoggedIn = false;
  state.currentChat = null;
  state.isGroup = false;
  state.pollingActive = false;
  state.lastMessageId = 0;
  // NO reset callsAvailable - se mantiene entre sesiones
}
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
  
  // Listas de conversaciones
  recentChats: [],
  myGroups: [],
  
  // Disponibilidad de servicios
  callsAvailable: true,  // ✅ Flag para trackear si CallService está disponible
  voiceNotesAvailable: true,
  
  // Polling (usado solo como fallback)
  pollingActive: false,
  pollingInterval: null,
  lastMessageId: 0,
};

export function resetState() {
  state.currentUsername = null;
  state.isLoggedIn = false;
  state.currentChat = null;
  state.isGroup = false;
  state.recentChats = [];
  state.myGroups = [];
  state.pollingActive = false;
  state.pollingInterval = null;
  state.lastMessageId = 0;
  // NO resetear callsAvailable - se mantiene entre sesiones
}
// ============================================
// js/state.js - Estado global de la aplicaciÃ³n
// ============================================

export const state = {
  currentUsername: null,
  currentChat: null,
  isGroup: false,
  recentChats: [],
  myGroups: [],
  pollingInterval: null // Solo para historial (fallback)
  // notificationInterval eliminado - ahora es tiempo real via ICE
};

export function resetState() {
  state.currentUsername = null;
  state.currentChat = null;
  state.isGroup = false;
  state.recentChats = [];
  state.myGroups = [];
  state.pollingInterval = null;
}
// ============================================
// js/state.js - Manejo del estado global
// ============================================
export const state = {
  currentUsername: null,
  currentChat: null,
  isGroup: false,
  recentChats: [],
  myGroups: [],
  pollingInterval: null
};

export function resetState() {
  state.currentUsername = null;
  state.currentChat = null;
  state.isGroup = false;
  state.recentChats = [];
  state.myGroups = [];
  state.pollingInterval = null;
}

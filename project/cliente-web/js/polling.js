// ============================================
// js/polling.js - Auto-actualización CON notificaciones
// ============================================

import { state } from './state.js';
import { POLLING_INTERVAL } from './config.js';
import { loadHistory } from './messages.js';
import { checkNotifications } from './notifications.js'; // 🆕

export function startPolling() {
  stopPolling();
  
  console.log('🔄 Iniciando polling global');
  
  // Polling para el chat actual
  state.pollingInterval = setInterval(async () => {
    if (state.currentChat) {
      await loadHistory(state.currentChat, state.isGroup, false);
    }
  }, POLLING_INTERVAL);
  
  //  Polling para notificaciones (cada 5 segundos)
  state.notificationInterval = setInterval(async () => {
    await checkNotifications();
  }, 5000);
}

export function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
  
  if (state.notificationInterval) {
    clearInterval(state.notificationInterval);
    state.notificationInterval = null;
  }
}
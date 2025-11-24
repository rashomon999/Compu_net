// ============================================
// js/polling.js - Polling SOLO para historial (fallback)
// Las notificaciones ahora son en tiempo real via ICE
// ============================================

import { state } from './state.js';
import { POLLING_INTERVAL } from './config.js';
import { loadHistory } from './messages.js';

/**
 * Inicia polling para actualizar el historial del chat actual
 * NOTA: Las notificaciones push ya no usan polling, son en tiempo real
 */
export function startPolling() {
  stopPolling();
  
  console.log('🔄 Iniciando polling de historial (fallback)');
  
  // Polling SOLO para el chat actual (por si falla WebSocket)
  state.pollingInterval = setInterval(async () => {
    if (state.currentChat) {
      // Recargar historial sin loading para actualización suave
      await loadHistory(state.currentChat, state.isGroup, false);
    }
  }, POLLING_INTERVAL);
}

/**
 * Detiene el polling
 */
export function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
    console.log('⏸️ Polling detenido');
  }
}

/**
 * Obtiene el estado del polling
 */
export function isPollingActive() {
  return state.pollingInterval !== null;
}
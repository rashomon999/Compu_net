// ============================================
// js/polling.js - Auto-actualización
// ============================================
// 
import { state } from './state.js';
import { POLLING_INTERVAL } from './config.js';
import { loadHistory } from './messages.js';

export function startPolling() {
  stopPolling();
  
  if (!state.currentChat) return;
  
  console.log(`🔄 Polling: ${state.isGroup ? 'grupo' : 'chat'} ${state.currentChat}`);
  
  state.pollingInterval = setInterval(async () => {
    await loadHistory(state.currentChat, state.isGroup, false);
  }, POLLING_INTERVAL);
}

export function stopPolling() {
  if (state.pollingInterval) {
    console.log('⏹️ Deteniendo polling');
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
}
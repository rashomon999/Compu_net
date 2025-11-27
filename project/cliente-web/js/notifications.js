// ============================================
// js/notifications.js - POLLING SIMPLE
// ✅ Usa getNewMessages() de NotificationService
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { loadHistory } from './messages.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';

let notificationPollingInterval = null;
const POLL_INTERVAL = 1000; // 1 segundo

/**
 * Iniciar polling de notificaciones
 */
export async function subscribeToRealTimeNotifications(username) {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  INICIANDO POLLING (getNewMessages)    ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Usuario:', username.padEnd(30), '║');
    console.log('║  Intervalo: 1 segundo                  ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    // Detener polling anterior si existe
    if (notificationPollingInterval) {
      clearInterval(notificationPollingInterval);
    }
    
    // ========================================
    // POLLING: Llamar a getNewMessages() cada 1s
    // ========================================
    notificationPollingInterval = setInterval(async () => {
      try {
        // Llamar a getNewMessages() del servidor
        const newMessages = await iceClient.notificationService.getNewMessages(username);
        
        if (newMessages && newMessages.length > 0) {
          console.log('📬 ' + newMessages.length + ' mensaje(s) nuevo(s)');
          
          // Procesar cada mensaje
          for (const msg of newMessages) {
            await handleNewMessage(msg);
          }
        }
        
      } catch (error) {
        // No hacer ruido con errores de timeout
        if (!error.message?.includes('timeout')) {
          // console.warn('⚠️ [POLLING] Error:', error.message);
        }
      }
    }, POLL_INTERVAL);
    
    console.log('✅ Polling ACTIVO - Escuchando mensajes cada 1 segundo\n');
    
  } catch (error) {
    console.error('❌ Error en subscribeToRealTimeNotifications:', error);
    throw error;
  }
}

/**
 * Detener polling
 */
export function stopNotificationPolling() {
  if (notificationPollingInterval) {
    clearInterval(notificationPollingInterval);
    notificationPollingInterval = null;
    console.log('🛑 Polling detenido');
  }
}

/**
 * Procesar mensaje nuevo
 */
async function handleNewMessage(msg) {
  console.log('\n🔔 ════════════════════════════════════════');
  console.log('📬 MENSAJE NUEVO');
  console.log('════════════════════════════════════════');
  console.log('   De:      ', msg.sender);
  console.log('   Para:    ', msg.recipient);
  console.log('   Grupo:   ', msg.isGroup);
  console.log('   Contenido:', msg.content.substring(0, 40) + (msg.content.length > 40 ? '...' : ''));
  console.log('════════════════════════════════════════\n');
  
  // ========================================
  // 1. ACTUALIZAR LISTAS
  // ========================================
  try {
    if (!msg.isGroup) {
      await loadRecentChatsFromICE();
    } else {
      await loadGroupsFromICE();
    }
  } catch (err) {
    console.warn('⚠️ Error actualizando listas:', err.message);
  }
  
  // ========================================
  // 2. VERIFICAR SI RECARGAR HISTORIAL
  // ========================================
  
  if (!state.currentChat) {
    // No hay chat abierto, mostrar notificación
    console.log('   → No hay chat abierto, mostrando notificación');
    showNotificationToast(msg);
    playNotificationSound();
    return;
  }
  
  let shouldReload = false;
  let reason = '';
  
  // Caso 1: Mensaje grupal
  if (msg.isGroup) {
    if (state.isGroup && msg.recipient === state.currentChat) {
      shouldReload = true;
      reason = 'Mensaje nuevo en grupo ' + state.currentChat;
    }
  }
  // Caso 2: Mensaje privado
  else {
    if (!state.isGroup) {
      // Mensaje es DE alguien O PARA alguien (eco)
      const isFrom = msg.sender === state.currentChat;
      const isTo = msg.recipient === state.currentChat;
      
      if (isFrom || isTo) {
        shouldReload = true;
        reason = 'Mensaje en chat con ' + state.currentChat;
      }
    }
  }
  
  // ========================================
  // 3. RECARGAR SI ES NECESARIO
  // ========================================
  if (shouldReload) {
    console.log('   🔄 RECARGANDO HISTORIAL');
    console.log('      Razón: ' + reason);
    
    try {
      // Pequeño delay para que el servidor haya guardado
      await new Promise(r => setTimeout(r, 50));
      
      await loadHistory(state.currentChat, state.isGroup, false);
      console.log('   ✅ Historial actualizado');
      
    } catch (error) {
      console.error('   ❌ Error recargando:', error.message);
    }
  } else {
    // No es el chat actual, mostrar toast
    console.log('   → Notificación toast (no es chat actual)');
    showNotificationToast(msg);
  }
  
  playNotificationSound();
  console.log('🔔 ════════════════════════════════════════\n');
}

/**
 * Mostrar notificación visual
 */
function showNotificationToast(msg) {
  const from = msg.isGroup ? `${msg.sender} en ${msg.recipient}` : msg.sender;
  const content = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
  
  const notifDiv = document.createElement('div');
  notifDiv.className = 'notification-toast';
  notifDiv.innerHTML = `
    <strong>${msg.isGroup ? '👥' : '💬'} ${from}</strong>
    <p>${content}</p>
  `;
  
  // Clickeable
  notifDiv.style.cursor = 'pointer';
  notifDiv.onclick = async () => {
    if (msg.isGroup) {
      const { openGroupChat } = await import('./groups.js');
      openGroupChat(msg.recipient);
    } else {
      const { openChatFromList } = await import('./chats.js');
      openChatFromList(msg.sender);
    }
    notifDiv.remove();
  };
  
  document.body.appendChild(notifDiv);
  
  setTimeout(() => notifDiv.classList.add('show'), 10);
  
  setTimeout(() => {
    notifDiv.classList.remove('show');
    setTimeout(() => notifDiv.remove(), 300);
  }, 5000);
}

/**
 * Reproducir sonido
 */
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Silenciar errores de audio
  }
}
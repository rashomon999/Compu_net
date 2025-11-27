// ============================================
// js/notifications.js - POLLING CON AUTO-RELOAD
// ✅ Recarga automática al abrir un chat
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
  console.log('📬 MENSAJE NUEVO RECIBIDO');
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
      console.log('   📋 Chats actualizados');
    } else {
      await loadGroupsFromICE();
      console.log('   📋 Grupos actualizados');
    }
  } catch (err) {
    console.warn('⚠️ Error actualizando listas:', err.message);
  }
  
  // ========================================
  // 2. VERIFICAR SI RECARGAR HISTORIAL
  // ========================================
  
  // ⚠️ CRÍTICO: Determinar si es el chat actual
  let isCurrentChat = false;
  let chatName = '';
  
  if (msg.isGroup) {
    // Mensaje grupal
    isCurrentChat = state.isGroup && msg.recipient === state.currentChat;
    chatName = msg.recipient;
  } else {
    // Mensaje privado
    if (!state.isGroup) {
      // El mensaje es DEL remitente O PARA el remitente (eco)
      const isFromCurrentChat = msg.sender === state.currentChat;
      const isToCurrentChat = msg.recipient === state.currentChat;
      
      isCurrentChat = isFromCurrentChat || isToCurrentChat;
      chatName = msg.sender === state.currentUsername ? msg.recipient : msg.sender;
    }
  }
  
  console.log('   → isCurrentChat:', isCurrentChat);
  console.log('   → state.currentChat:', state.currentChat);
  
  // ========================================
  // 3. RECARGAR SI ES EL CHAT ACTUAL
  // ========================================
  if (isCurrentChat && state.currentChat) {
    console.log('   🔄 ¡ES EL CHAT ACTUAL! Recargando...');
    
    try {
      // Pequeño delay para que el servidor haya guardado
      await new Promise(r => setTimeout(r, 50));
      
      // Recargar historial del chat actual
      await loadHistory(state.currentChat, state.isGroup, false);
      console.log('   ✅ Historial recargado automáticamente');
      
    } catch (error) {
      console.error('   ❌ Error recargando:', error.message);
    }
    
  } else if (state.currentChat) {
    // Hay un chat abierto pero NO es el actual
    console.log('   💬 Mensaje de otro chat, mostrando notificación');
    showNotificationToast(msg);
    
  } else {
    // NO hay chat abierto
    console.log('   → Sin chat abierto, mostrando notificación');
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
  
  // Clickeable para abrir el chat
  notifDiv.style.cursor = 'pointer';
  notifDiv.onclick = async () => {
    try {
      if (msg.isGroup) {
        const { openGroupChat } = await import('./groups.js');
        openGroupChat(msg.recipient);
      } else {
        const { openChatFromList } = await import('./chats.js');
        // Abrir chat con el remitente
        openChatFromList(msg.sender);
      }
    } catch (error) {
      console.error('Error abriendo chat:', error);
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
// ============================================
// js/notifications.js - Notificaciones en Tiempo Real con ICE
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { loadHistory } from './messages.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';

/**
 * Suscribirse a notificaciones push del servidor
 */
export async function subscribeToRealTimeNotifications(username) {
  try {
    await iceClient.subscribeToNotifications(username, {
      
      // Callback cuando llega un mensaje nuevo
      onNewMessage: (msg) => {
        console.log('🔔 Mensaje nuevo recibido:', msg);
        
        // Si es el chat actual abierto, recargar automáticamente
        if (state.currentChat) {
          if (state.isGroup && msg.isGroup && msg.recipient === state.currentChat) {
            // Mensaje del grupo actual
            loadHistory(state.currentChat, true, false);
          } else if (!state.isGroup && !msg.isGroup && msg.sender === state.currentChat) {
            // Mensaje privado del chat actual
            loadHistory(state.currentChat, false, false);
          } else {
            // Mensaje de otra conversación - mostrar notificación
            showNotificationToast(msg);
          }
        } else {
          // No hay chat abierto - solo notificar
          showNotificationToast(msg);
        }
        
        // Actualizar listas de chats/grupos
        if (!msg.isGroup) {
          loadRecentChatsFromICE();
        } else {
          loadGroupsFromICE();
        }
        
        // Reproducir sonido
        playNotificationSound();
      },
      
      // Callback cuando se crea un grupo
      onGroupCreated: (groupName, creator) => {
        console.log('🔔 Grupo creado:', groupName);
        
        // Recargar lista de grupos
        loadGroupsFromICE();
        
        // Mostrar notificación
        showSystemNotification(`📁 Nuevo grupo: ${groupName}`, `Creado por ${creator}`);
      },
      
      // Callback cuando alguien se une a un grupo
      onUserJoinedGroup: (groupName, username) => {
        console.log('🔔 Usuario se unió:', username, '→', groupName);
        
        // Si estoy en ese grupo, recargar historial para ver el mensaje del sistema
        if (state.currentChat === groupName && state.isGroup) {
          loadHistory(groupName, true, false);
        }
        
        showSystemNotification(`👋 ${username} se unió`, `Grupo: ${groupName}`);
      }
    });
    
    console.log('✅ Notificaciones en tiempo real activadas');
    
  } catch (error) {
    console.error('❌ Error activando notificaciones:', error);
  }
}

/**
 * Mostrar notificación toast para mensajes
 */
function showNotificationToast(msg) {
  const from = msg.isGroup ? `${msg.sender} en ${msg.recipient}` : msg.sender;
  const content = msg.type === 'VOICE' ? '🎤 Nota de voz' : msg.content;
  
  const notifDiv = document.createElement('div');
  notifDiv.className = 'notification-toast';
  notifDiv.innerHTML = `
    <strong>${msg.isGroup ? '👥' : '💬'} ${from}</strong>
    <p>${content.substring(0, 50)}${content.length > 50 ? '...' : ''}</p>
  `;
  
  // Hacer clickeable para abrir el chat
  notifDiv.style.cursor = 'pointer';
  notifDiv.onclick = () => {
    if (msg.isGroup) {
      // Abrir grupo
      const openGroupChat = require('./groups.js').openGroupChat;
      openGroupChat(msg.recipient);
    } else {
      // Abrir chat privado
      const openChatFromList = require('./chats.js').openChatFromList;
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
 * Mostrar notificación del sistema
 */
function showSystemNotification(title, message) {
  const notifDiv = document.createElement('div');
  notifDiv.className = 'notification-toast system';
  notifDiv.innerHTML = `
    <strong>${title}</strong>
    <p>${message}</p>
  `;
  
  document.body.appendChild(notifDiv);
  
  setTimeout(() => notifDiv.classList.add('show'), 10);
  
  setTimeout(() => {
    notifDiv.classList.remove('show');
    setTimeout(() => notifDiv.remove(), 300);
  }, 4000);
}

/**
 * Reproducir sonido de notificación
 */
function playNotificationSound() {
  try {
    // Crear audio inline (beep corto)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    // Silenciar errores de audio
  }
}
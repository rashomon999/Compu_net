// ============================================
// js/notifications.js - Sistema de notificaciones
// ============================================

import { API_URL } from './config.js';
import { state } from './state.js';
import { loadRecentChats } from './chats.js';

export async function checkNotifications() {
  if (!state.currentUsername) return;
  
  try {
    const res = await fetch(`${API_URL}/notificaciones/${state.currentUsername}`);
    const data = await res.json();
    
    if (data.success && data.messages && data.messages.length > 0) {
      console.log(`🔔 ${data.count} mensajes nuevos`);
      
      // Actualizar lista de conversaciones
      const newChats = new Set(state.recentChats);
      
      data.messages.forEach(msg => {
        if (!msg.isGroup || msg.isGroup === 'false') {
          // Mensaje privado
          if (!newChats.has(msg.from)) {
            state.recentChats.unshift(msg.from);
            newChats.add(msg.from);
          }
          
          // Mostrar notificación visual
          showNotification(msg.from, msg.message);
        }
      });
      
      // Recargar lista de chats
      loadRecentChats();
      
      // Si el chat actual está abierto, recargar
      if (state.currentChat && !state.isGroup) {
        const hasMessageFromCurrent = data.messages.some(
          m => m.from === state.currentChat
        );
        
        if (hasMessageFromCurrent) {
          // El polling normal ya se encarga de actualizar
          console.log(`💬 Mensaje de ${state.currentChat} (auto-actualizado)`);
        }
      }
    }
  } catch (err) {
    console.error('Error checking notifications:', err);
  }
}

function showNotification(from, message) {
  // Solo mostrar si NO es el chat actual abierto
  if (state.currentChat === from && !state.isGroup) {
    return;
  }
  
  const notifDiv = document.createElement('div');
  notifDiv.className = 'notification-toast';
  notifDiv.innerHTML = `
    <strong>💬 ${from}</strong>
    <p>${message.substring(0, 50)}${message.length > 50 ? '...' : ''}</p>
  `;
  
  document.body.appendChild(notifDiv);
  
  setTimeout(() => notifDiv.classList.add('show'), 10);
  
  setTimeout(() => {
    notifDiv.classList.remove('show');
    setTimeout(() => notifDiv.remove(), 300);
  }, 4000);
}
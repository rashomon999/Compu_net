// ============================================
// js/notifications.js - Notificaciones en Tiempo Real CORREGIDAS
// ✅ CON LOGGING DETALLADO PARA DEBUG
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
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  SUSCRIBIENDO A NOTIFICACIONES PUSH    ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Usuario:', username.padEnd(30), '║');
    console.log('╚════════════════════════════════════════╝');
    
    await iceClient.subscribeToNotifications(username, {
      
      // ════════════════════════════════════════
      // 📬 CALLBACK: NUEVO MENSAJE
      // ════════════════════════════════════════
      onNewMessage: async (msg) => {
        console.log('\n🔔 ════════════════════════════════════════');
        console.log('📬 MENSAJE NUEVO RECIBIDO (PUSH)');
        console.log('════════════════════════════════════════');
        console.log('   De:        ', msg.sender);
        console.log('   Para:      ', msg.recipient);
        console.log('   Es grupo:  ', msg.isGroup);
        console.log('   Contenido: ', msg.content.substring(0, 50));
        console.log('════════════════════════════════════════\n');
        
        // ✅ 1. ACTUALIZAR LISTAS DE CHATS/GRUPOS
        console.log('   📋 Actualizando listas...');
        if (!msg.isGroup) {
          await loadRecentChatsFromICE();
          console.log('   ✅ Lista de chats actualizada');
        } else {
          await loadGroupsFromICE();
          console.log('   ✅ Lista de grupos actualizada');
        }
        
        // ✅ 2. VERIFICAR SI ES EL CHAT ACTUAL
        console.log('   🔍 Verificando chat actual...');
        console.log('      state.currentChat:', state.currentChat);
        console.log('      state.isGroup:    ', state.isGroup);
        
        let shouldReload = false;
        let reloadReason = '';
        
        if (state.currentChat) {
          // CASO 1: Mensaje grupal Y estoy en ese grupo
          if (state.isGroup && msg.isGroup && msg.recipient === state.currentChat) {
            shouldReload = true;
            reloadReason = 'Mensaje del grupo actual';
          }
          
          // CASO 2: Mensaje privado Y es de mi chat actual
          else if (!state.isGroup && !msg.isGroup) {
            // El mensaje es PARA MÍ desde el chat actual
            // O el mensaje es MÍO hacia ese usuario (echo)
            if (msg.sender === state.currentChat || msg.recipient === state.currentChat) {
              shouldReload = true;
              reloadReason = 'Mensaje del chat privado actual';
            }
          }
        }
        
        // ✅ 3. RECARGAR HISTORIAL SI APLICA
        if (shouldReload) {
          console.log('   🔄 RECARGANDO HISTORIAL');
          console.log('      Razón:', reloadReason);
          
          try {
            await loadHistory(state.currentChat, state.isGroup, false);
            console.log('   ✅ Historial actualizado automáticamente');
          } catch (error) {
            console.error('   ❌ Error recargando historial:', error);
          }
        } else {
          console.log('   ℹ️ No es el chat actual, mostrando notificación toast');
          showNotificationToast(msg);
        }
        
        // ✅ 4. REPRODUCIR SONIDO
        playNotificationSound();
        
        console.log('🔔 ════════════════════════════════════════\n');
      },
      
      // ════════════════════════════════════════
      // 📢 CALLBACK: GRUPO CREADO
      // ════════════════════════════════════════
      onGroupCreated: async (groupName, creator) => {
        console.log('📢 [NOTIF] Grupo creado:', groupName, 'por', creator);
        
        // Recargar lista de grupos
        await loadGroupsFromICE();
        
        // Mostrar notificación
        showSystemNotification(`📁 Nuevo grupo: ${groupName}`, `Creado por ${creator}`);
      },
      
      // ════════════════════════════════════════
      // 👋 CALLBACK: USUARIO SE UNIÓ A GRUPO
      // ════════════════════════════════════════
      onUserJoinedGroup: async (groupName, username) => {
        console.log('👋 [NOTIF] Usuario se unió:', username, '→', groupName);
        
        // Si estoy en ese grupo, recargar historial para ver el mensaje del sistema
        if (state.currentChat === groupName && state.isGroup) {
          console.log('   🔄 Recargando historial del grupo...');
          await loadHistory(groupName, true, false);
        }
        
        showSystemNotification(`👋 ${username} se unió`, `Grupo: ${groupName}`);
      }
    });
    
    console.log('✅ Notificaciones en tiempo real ACTIVAS');
    console.log('   📡 Escuchando mensajes automáticamente...\n');
    
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
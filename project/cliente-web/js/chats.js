// ============================================
// js/chats.js - Gestión de chats privados con ICE
// ✅ Sin desconexión visual del chat
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, updateChatHeader, showMessageInput } from './ui.js';
import { loadHistory } from './messages.js';

// 🆕 Cargar conversaciones desde ICE (reemplaza HTTP)
export async function loadRecentChatsFromICE() {
  try {
    // Obtener conversaciones via ICE
    const conversations = await iceClient.getRecentConversations(state.currentUsername);
    
    state.recentChats = conversations;
    loadRecentChats(); // Actualizar UI
    
    console.log('✔ Conversaciones cargadas desde ICE:', state.recentChats);
  } catch (err) {
    console.error('Error cargando conversaciones desde ICE:', err);
    // Fallar silenciosamente
  }
}

// ⚠️ MANTENER para compatibilidad (ya no se usa)
export async function loadRecentChatsFromServer() {
  console.warn('loadRecentChatsFromServer() está deprecated. Usa loadRecentChatsFromICE()');
  await loadRecentChatsFromICE();
}

export function loadRecentChats() {
  const list = document.getElementById('chatsList');
  
  if (state.recentChats.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay conversaciones aún</p>';
    return;
  }
  
  list.innerHTML = '';
  state.recentChats.forEach(chatUser => {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    
    // ✅ CRÍTICO: Marcar como activo solo si coincide exactamente
    if (state.currentChat === chatUser && !state.isGroup) {
      div.classList.add('active');
    }
    
    div.innerHTML = `<span>💬</span><strong>${chatUser}</strong>`;
    div.onclick = () => openChatFromList(chatUser);
    list.appendChild(div);
  });
}

export function openChat() {
  const user = document.getElementById('newChatUser').value.trim();
  
  if (!user) {
    showError('Ingresa un nombre de usuario');
    return;
  }
  
  if (user === state.currentUsername) {
    showError('No puedes chatear contigo mismo');
    return;
  }
  
  document.getElementById('newChatUser').value = '';
  openChatFromList(user);
}

export function openChatFromList(user) {
  // ✅ CRÍTICO: Si ya estamos en este chat, NO recargar
  if (state.currentChat === user && !state.isGroup) {
    console.log('✅ Ya estás en este chat, sin recargar');
    return;
  }
  
  console.log('📂 Abriendo chat con:', user);
  
  // Agregar a la lista si no existe
  if (!state.recentChats.includes(user)) {
    state.recentChats.unshift(user);
    loadRecentChats();
  }
  
  state.currentChat = user;
  state.isGroup = false;
  
  updateChatHeader(`💬 Chat con ${user}`, 'Conversación privada');
  showMessageInput();
  loadHistory(user, false, true);
  
  // ✅ Actualizar visualmente el chat activo
  updateActiveChatInUI(user);
}

function updateActiveChatInUI(chatUser) {
  const list = document.getElementById('chatsList');
  const items = list.querySelectorAll('.conversation-item');
  
  items.forEach(item => {
    const itemName = item.querySelector('strong').textContent;
    if (itemName === chatUser) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}
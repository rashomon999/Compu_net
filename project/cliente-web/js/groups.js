// ============================================
// js/groups.js - Gestión de grupos con ICE
// ✅ Sin desconexión visual del chat
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, updateChatHeader, showMessageInput } from './ui.js';
import { loadHistory } from './messages.js';

export async function createGroup() {
  const groupName = document.getElementById('newGroupName').value.trim();
  
  if (!groupName) {
    showError('Ingresa un nombre para el grupo');
    return;
  }

  try {
    const result = await iceClient.createGroup(groupName, state.currentUsername);
    
    if (result.startsWith('SUCCESS')) {
      alert('✔ Grupo creado: ' + groupName);
      document.getElementById('newGroupName').value = '';
      
      if (!state.myGroups.includes(groupName)) {
        state.myGroups.push(groupName);
      }
      
      await loadGroupsFromICE();
      openGroupChat(groupName);
    } else {
      showError(result.replace('ERROR:', '').trim());
    }
  } catch (err) {
    console.error('Error creando grupo:', err);
    showError('Error de conexión');
  }
}

export async function joinGroup() {
  const groupName = document.getElementById('joinGroupName').value.trim();
  
  if (!groupName) {
    showError('Ingresa el nombre del grupo');
    return;
  }

  try {
    const result = await iceClient.joinGroup(groupName, state.currentUsername);
    
    if (result.startsWith('SUCCESS')) {
      alert('✔ Te uniste al grupo: ' + groupName);
      document.getElementById('joinGroupName').value = '';
      
      if (!state.myGroups.includes(groupName)) {
        state.myGroups.push(groupName);
      }
      
      await loadGroupsFromICE();
      openGroupChat(groupName);
    } else {
      showError(result.replace('ERROR:', '').trim());
    }
  } catch (err) {
    console.error('Error uniéndose:', err);
    showError('Error de conexión');
  }
}

export async function loadGroupsFromICE() {
  try {
    // Obtener grupos via ICE
    const groups = await iceClient.listUserGroups(state.currentUsername);
    
    state.myGroups = groups;
    
    const list = document.getElementById('groupsList');
    
    if (groups.length === 0) {
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
      return;
    }
    
    list.innerHTML = '';
    groups.forEach(groupName => {
      const div = document.createElement('div');
      div.className = 'conversation-item';
      
      // ✅ CRÍTICO: Marcar como activo solo si coincide exactamente
      if (state.currentChat === groupName && state.isGroup) {
        div.classList.add('active');
      }
      
      div.innerHTML = `<span>👥</span><strong>${groupName}</strong>`;
      div.onclick = () => openGroupChat(groupName);
      list.appendChild(div);
    });
    
    console.log('✔ Grupos cargados:', groups);
    
  } catch (err) {
    console.error('❌ Error cargando grupos:', err);
    const list = document.getElementById('groupsList');
    list.innerHTML = '<p class="empty-state">Error al cargar grupos</p>';
  }
}

export function openGroupChat(groupName) {
  // ✅ CRÍTICO: Si ya estamos en este grupo, NO recargar
  if (state.currentChat === groupName && state.isGroup) {
    console.log('✅ Ya estás en este grupo, sin recargar');
    return;
  }
  
  console.log('📂 Abriendo grupo:', groupName);
  
  if (!state.myGroups.includes(groupName)) {
    showError('No eres miembro de este grupo');
    console.warn('⚠️ Intento de acceder a grupo sin membresía:', groupName);
    return;
  }

  state.currentChat = groupName;
  state.isGroup = true;
  
  updateChatHeader(`👥 Grupo: ${groupName}`, 'Chat grupal');
  showMessageInput();
  loadHistory(groupName, true, true);
  
  // ✅ Actualizar visualmente el grupo activo
  updateActiveGroupInUI(groupName);
}

function updateActiveGroupInUI(groupName) {
  const list = document.getElementById('groupsList');
  const items = list.querySelectorAll('.conversation-item');
  
  items.forEach(item => {
    const itemName = item.querySelector('strong').textContent;
    if (itemName === groupName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}
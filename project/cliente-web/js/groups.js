// ============================================
// js/groups.js - Gestión de grupos
// ============================================

import { API_URL } from './config.js';
import { state } from './state.js';
import { showError, updateChatHeader, showMessageInput } from './ui.js';
import { loadHistory } from './messages.js';
import { startPolling } from './polling.js';

export async function createGroup() {
  const groupName = document.getElementById('newGroupName').value.trim();
  
  if (!groupName) {
    showError('Ingresa un nombre para el grupo');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/grupos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nombre: groupName,
        creator: state.currentUsername 
      })
    });

    const data = await res.json();
    
    if (data.success) {
      alert('✓ Grupo creado: ' + groupName);
      document.getElementById('newGroupName').value = '';
      
      if (!state.myGroups.includes(groupName)) {
        state.myGroups.push(groupName);
      }
      
      loadGroups();
      openGroupChat(groupName);
    } else {
      showError(data.error || 'Error al crear grupo');
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
    const res = await fetch(`${API_URL}/grupos/unirse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        grupo: groupName,
        username: state.currentUsername 
      })
    });

    const data = await res.json();
    
    if (data.success) {
      alert('✓ Te uniste al grupo: ' + groupName);
      document.getElementById('joinGroupName').value = '';
      
      if (!state.myGroups.includes(groupName)) {
        state.myGroups.push(groupName);
      }
      
      loadGroups();
      openGroupChat(groupName);
    } else {
      showError(data.error || 'Error al unirse');
    }
  } catch (err) {
    console.error('Error uniéndose:', err);
    showError('Error de conexión');
  }
}

export async function loadGroups() {
  try {
    const res = await fetch(`${API_URL}/grupos?username=${state.currentUsername}`);
    const data = await res.json();
    
    const list = document.getElementById('groupsList');
    
    if (!data.success || !data.grupos) {
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
      return;
    }
    
    state.myGroups = [];
    list.innerHTML = '';
    
    if (data.grupos.includes('Grupos disponibles:')) {
      const lines = data.grupos.split('\n').slice(1);
      lines.forEach(line => {
        const match = line.match(/- (.+?) \(/);
        if (match) {
          const groupName = match[1].trim();
          state.myGroups.push(groupName);
          
          const div = document.createElement('div');
          div.className = 'conversation-item';
          if (state.currentChat === groupName && state.isGroup) {
            div.classList.add('active');
          }
          div.innerHTML = `<span>👥</span><strong>${groupName}</strong>`;
          div.onclick = () => openGroupChat(groupName);
          list.appendChild(div);
        }
      });
    }
    
    if (state.myGroups.length === 0) {
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
    }
  } catch (err) {
    console.error('Error cargando grupos:', err);
  }
}

export function openGroupChat(groupName) {
  state.currentChat = groupName;
  state.isGroup = true;
  
  updateChatHeader(`👥 Grupo: ${groupName}`, 'Chat grupal');
  showMessageInput();
  loadHistory(groupName, true, true);
  startPolling();
  loadGroups();
}

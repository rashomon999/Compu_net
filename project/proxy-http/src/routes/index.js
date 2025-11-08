const express = require('express');
const { validateRequired, preventInjection } = require('../middleware/validation');

function setupRoutes(app, socketManager, commandService) {
  
  // ========== AUTH ==========
  app.post('/register', validateRequired(['username']), async (req, res) => {
    try {
      const { username } = req.body;
      console.log(`[API] Registrando: ${username}`);
      await socketManager.getOrCreateSocket(username);
      res.json({ success: true, message: `Bienvenido ${username}`, username });
    } catch (err) {
      console.error('[API] Error register:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/logout', validateRequired(['username']), (req, res) => {
    try {
      const { username } = req.body;
      socketManager.disconnect(username);
      res.json({ success: true, message: 'Sesión cerrada' });
    } catch (err) {
      console.error('[API] Error logout:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ========== MENSAJES ==========
  app.post('/enviar', validateRequired(['from', 'to', 'message']), preventInjection, async (req, res) => {
    try {
      const { from, to, message } = req.body;
      console.log(`[API] ${from} → ${to}: ${message}`);
      
      const response = await commandService.sendCommand(from, {
        command: 'MSG_USER',
        recipient: to,
        message
      });
      
      res.json({ success: response.success, message: response.message, data: response.data });
    } catch (err) {
      console.error('[API] Error enviar:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/enviar-grupo', validateRequired(['from', 'grupo', 'message']), preventInjection, async (req, res) => {
    try {
      const { from, grupo, message } = req.body;
      console.log(`[API] ${from} → [${grupo}]: ${message}`);
      
      const response = await commandService.sendCommand(from, {
        command: 'MSG_GROUP',
        groupName: grupo,
        message
      });
      
      res.json({ success: response.success, message: response.message, data: response.data });
    } catch (err) {
      console.error('[API] Error enviar-grupo:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ========== GRUPOS ==========
  app.post('/grupos', validateRequired(['nombre', 'creator']), async (req, res) => {
    try {
      const { nombre, creator } = req.body;
      console.log(`[API] Crear grupo: ${nombre}`);
      
      const response = await commandService.sendCommand(creator, {
        command: 'CREATE_GROUP',
        groupName: nombre
      });
      
      res.json({ success: response.success, message: response.message, data: response.data });
    } catch (err) {
      console.error('[API] Error crear grupo:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/grupos/unirse', validateRequired(['grupo', 'username']), async (req, res) => {
    try {
      const { grupo, username } = req.body;
      console.log(`[API] ${username} → grupo ${grupo}`);
      
      const response = await commandService.sendCommand(username, {
        command: 'JOIN_GROUP',
        groupName: grupo
      });
      
      res.json({ success: response.success, message: response.message, data: response.data });
    } catch (err) {
      console.error('[API] Error unirse:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/grupos', validateRequired(['username']), async (req, res) => {
    try {
      const { username } = req.query;
      console.log(`[API] Listar grupos: ${username}`);
      
      const response = await commandService.sendCommand(username, {
        command: 'LIST_GROUPS'
      });
      
      res.json({ success: response.success, message: response.message, grupos: response.message });
    } catch (err) {
      console.error('[API] Error listar grupos:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ========== HISTORIAL ==========
  app.get('/historial/:usuario', validateRequired(['from']), async (req, res) => {
    try {
      const { usuario } = req.params;
      const { from } = req.query;
      
      console.log(`[API] Historial: ${from} ↔ ${usuario}`);
      
      const response = await commandService.sendCommand(from, {
        command: 'VIEW_HISTORY',
        otherUser: usuario
      });
      
      res.json({ success: response.success, historial: response.message, usuario, from });
    } catch (err) {
      console.error('[API] Error historial:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/historial-grupo/:grupo', validateRequired(['username']), async (req, res) => {
    try {
      const { grupo } = req.params;
      const { username } = req.query;
      
      console.log(`[API] Historial grupo: ${grupo}`);
      
      const response = await commandService.sendCommand(username, {
        command: 'VIEW_GROUP_HISTORY',
        groupName: grupo
      });
      
      res.json({ success: response.success, historial: response.message, grupo });
    } catch (err) {
      console.error('[API] Error historial grupo:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/usuarios', validateRequired(['username']), async (req, res) => {
    try {
      const { username } = req.query;
      console.log(`[API] Listar usuarios: ${username}`);
      
      const response = await commandService.sendCommand(username, {
        command: 'LIST_USERS'
      });
      
      res.json({ success: response.success, usuarios: response.message });
    } catch (err) {
      console.error('[API] Error listar usuarios:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ========== HEALTH ==========
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      proxy: 'running',
      protocol: 'JSON',
      activeConnections: socketManager.getActiveConnectionsCount()
    });
  });
}

module.exports = setupRoutes;
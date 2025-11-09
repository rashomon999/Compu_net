// routes/index.js
module.exports = (app, socketManager, commandService) => {
  
  // ==================== REGISTRO ====================
  app.post('/register', async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
      return res.json({ success: false, error: 'Username requerido' });
    }
    
    const result = await commandService.register(username);
    res.json(result);
  });

  // ==================== MENSAJES ====================
  app.post('/enviar', async (req, res) => {
    const { from, to, message } = req.body;
    
    if (!from || !to || !message) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }
    
    const result = await commandService.execute(from, {
      command: 'MSG_USER',
      recipient: to,
      message
    });
    
    res.json(result);
  });

  app.post('/enviar-grupo', async (req, res) => {
    const { from, grupo, message } = req.body;
    
    if (!from || !grupo || !message) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }
    
    const result = await commandService.execute(from, {
      command: 'MSG_GROUP',
      groupName: grupo,
      message
    });
    
    res.json(result);
  });

  // ==================== HISTORIAL ====================
  app.get('/historial/:otherUser', async (req, res) => {
    const { from } = req.query;
    const { otherUser } = req.params;
    
    if (!from) {
      return res.json({ success: false, error: 'Usuario no especificado' });
    }
    
    const result = await commandService.execute(from, {
      command: 'VIEW_HISTORY',
      otherUser
    });
    
    if (result.success && result.message) {
      result.historial = result.message;
    }
    
    res.json(result);
  });

  app.get('/historial-grupo/:groupName', async (req, res) => {
    const { username } = req.query;
    const { groupName } = req.params;
    
    if (!username) {
      return res.json({ success: false, error: 'Usuario no especificado' });
    }
    
    const result = await commandService.execute(username, {
      command: 'VIEW_GROUP_HISTORY',
      groupName
    });
    
    if (result.success && result.message) {
      result.historial = result.message;
    }
    
    res.json(result);
  });

  // ==================== CONVERSACIONES RECIENTES ====================
  app.get('/conversaciones/:username', async (req, res) => {
    const { username } = req.params;
    
    const result = await commandService.execute(username, {
      command: 'GET_RECENT_CONVERSATIONS'
    });
    
    if (result.success && result.data && result.data.conversations) {
      result.conversations = result.data.conversations;
    }
    
    res.json(result);
  });

  // ==================== NOTIFICACIONES ====================
  app.get('/notificaciones/:username', async (req, res) => {
    const { username } = req.params;
    
    const result = await commandService.execute(username, {
      command: 'GET_NEW_MESSAGES'
    }, 5000);
    
    if (result.success && result.data) {
      result.messages = result.data.messages || [];
      result.count = result.data.count || 0;
    }
    
    res.json(result);
  });

  // 🆕 MARCAR COMO LEÍDO
  app.post('/marcar-leido/:username', async (req, res) => {
    const { username } = req.params;
    
    const result = await commandService.execute(username, {
      command: 'MARK_AS_READ'
    }, 3000);
    
    res.json(result);
  });

  // ==================== GRUPOS ====================
  app.post('/grupos', async (req, res) => {
    const { nombre, creator } = req.body;
    
    if (!nombre || !creator) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }
    
    const result = await commandService.execute(creator, {
      command: 'CREATE_GROUP',
      groupName: nombre
    });
    
    res.json(result);
  });

  app.post('/grupos/unirse', async (req, res) => {
    const { grupo, username } = req.body;
    
    if (!grupo || !username) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }
    
    const result = await commandService.execute(username, {
      command: 'JOIN_GROUP',
      groupName: grupo
    });
    
    res.json(result);
  });

  app.get('/grupos', async (req, res) => {
    const { username } = req.query;
    
    if (!username) {
      return res.json({ success: false, error: 'Usuario no especificado' });
    }
    
    const result = await commandService.execute(username, {
      command: 'LIST_GROUPS'
    });
    
    if (result.success && result.message) {
      result.grupos = result.message;
    }
    
    res.json(result);
  });

  // ==================== USUARIOS ====================
  app.get('/usuarios/:username', async (req, res) => {
    const { username } = req.params;
    
    const result = await commandService.execute(username, {
      command: 'LIST_USERS'
    });
    
    res.json(result);
  });

  // ==================== HEALTH CHECK ====================
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      connections: socketManager.getActiveConnectionsCount(),
      timestamp: new Date().toISOString()
    });
  });
};
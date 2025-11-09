// proxy-http-tcp/src/routes/index.js

module.exports = (app, socketManager, commandService) => {
  
  // ==================== REGISTRO ====================
  
  app.post('/register', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.json({ success: false, error: 'Username requerido' });
  }

  try {
    console.log('[API] Registrando:', username);
    
    // register() ahora maneja todo el proceso
    const result = await commandService.register(username);
    
    if (result.success) {
      console.log(`[✓] ${username} registrado`);
    }
    
    res.json(result);
  } catch (err) {
    console.error('[ERROR] Registro:', err.message);
    res.json({ success: false, error: err.message });
  }
});

  // ==================== MENSAJES PRIVADOS ====================
  
  app.post('/enviar', async (req, res) => {
    const { from, to, message } = req.body;
    
    if (!from || !to || !message) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }

    try {
      console.log(`[API] ${from} → ${to}: ${message}`);
      
      const result = await commandService.execute(from, {
        command: 'MSG_USER',
        recipient: to,
        message
      });
      
      res.json(result);
    } catch (err) {
      console.error('[ERROR] Enviar mensaje:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // ==================== MENSAJES GRUPALES ====================
  
  app.post('/enviar-grupo', async (req, res) => {
    const { from, grupo, message } = req.body;
    
    if (!from || !grupo || !message) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }

    try {
      console.log(`[API] ${from} → [${grupo}]: ${message}`);
      
      const result = await commandService.execute(from, {
        command: 'MSG_GROUP',
        groupName: grupo,
        message
      });
      
      res.json(result);
    } catch (err) {
      console.error('[ERROR] Enviar mensaje grupo:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // ==================== HISTORIAL ====================
  
  app.get('/historial/:target', async (req, res) => {
    const { target } = req.params;
    const { from } = req.query;
    
    if (!from) {
      return res.json({ success: false, error: 'Falta parámetro from' });
    }

    try {
      console.log(`[API] Historial: ${from} ↔ ${target}`);
      
      const result = await commandService.execute(from, {
        command: 'VIEW_HISTORY',
        otherUser: target
      });
      
      res.json({ 
        success: true, 
        historial: result.message || 'No hay historial'
      });
    } catch (err) {
      console.error('[ERROR] Historial:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  app.get('/historial-grupo/:grupo', async (req, res) => {
    const { grupo } = req.params;
    const { username } = req.query;
    
    if (!username) {
      return res.json({ success: false, error: 'Falta parámetro username' });
    }

    try {
      console.log(`[API] Historial grupo: ${grupo} (${username})`);
      
      const result = await commandService.execute(username, {
        command: 'VIEW_GROUP_HISTORY',
        groupName: grupo
      });
      
      res.json({ 
        success: true, 
        historial: result.message || 'No hay historial'
      });
    } catch (err) {
      console.error('[ERROR] Historial grupo:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // ==================== 🆕 CONVERSACIONES RECIENTES ====================
  
  app.get('/conversaciones/:username', async (req, res) => {
    const { username } = req.params;
    
    if (!username) {
      return res.json({ success: false, error: 'Username requerido' });
    }

    try {
      console.log(`[API] Conversaciones de: ${username}`);
      
      const result = await commandService.execute(username, {
        command: 'GET_RECENT_CONVERSATIONS',
        username
      });
      
      if (result.success && result.data && result.data.conversations) {
        res.json({ 
          success: true, 
          conversations: result.data.conversations
        });
      } else {
        res.json({ 
          success: true, 
          conversations: [] 
        });
      }
    } catch (err) {
      console.error('[ERROR] Conversaciones:', err.message);
      res.json({ 
        success: false, 
        error: 'Error obteniendo conversaciones',
        conversations: []
      });
    }
  });

  // ==================== GRUPOS ====================
  
  app.post('/grupos', async (req, res) => {
    const { nombre, creator } = req.body;
    
    if (!nombre || !creator) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }

    try {
      console.log(`[API] Crear grupo: ${nombre} (${creator})`);
      
      const result = await commandService.execute(creator, {
        command: 'CREATE_GROUP',
        groupName: nombre
      });
      
      res.json(result);
    } catch (err) {
      console.error('[ERROR] Crear grupo:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  app.post('/grupos/unirse', async (req, res) => {
    const { grupo, username } = req.body;
    
    if (!grupo || !username) {
      return res.json({ success: false, error: 'Faltan parámetros' });
    }

    try {
      console.log(`[API] ${username} → unirse a ${grupo}`);
      
      const result = await commandService.execute(username, {
        command: 'JOIN_GROUP',
        groupName: grupo
      });
      
      res.json(result);
    } catch (err) {
      console.error('[ERROR] Unirse grupo:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  app.get('/grupos', async (req, res) => {
    const { username } = req.query;
    
    if (!username) {
      return res.json({ success: false, error: 'Falta parámetro username' });
    }

    try {
      console.log(`[API] Listar grupos: ${username}`);
      
      const result = await commandService.execute(username, {
        command: 'LIST_GROUPS'
      });
      
      res.json({ 
        success: true, 
        grupos: result.message || 'No hay grupos'
      });
    } catch (err) {
      console.error('[ERROR] Listar grupos:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // ==================== USUARIOS ====================
  
  app.get('/usuarios', async (req, res) => {
    const { username } = req.query;
    
    if (!username) {
      return res.json({ success: false, error: 'Falta parámetro username' });
    }

    try {
      console.log(`[API] Listar usuarios: ${username}`);
      
      const result = await commandService.execute(username, {
        command: 'LIST_USERS'
      });
      
      res.json({ 
        success: true, 
        usuarios: result.message || 'No hay usuarios'
      });
    } catch (err) {
      console.error('[ERROR] Listar usuarios:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // ==================== HEALTH CHECK ====================
  
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      connections: socketManager.getActiveConnections()
    });
  });

  // ==================== 🆕 NOTIFICACIONES ====================

app.get('/notificaciones/:username', async (req, res) => {
  const { username } = req.params;
  
  if (!username) {
    return res.json({ success: false, error: 'Username requerido' });
  }

  try {
    console.log(`[API] Notificaciones de: ${username}`);
    
    const result = await commandService.execute(username, {
      command: 'GET_NEW_MESSAGES'
    });
    
    if (result.success && result.data) {
      res.json({ 
        success: true, 
        messages: result.data.messages || [],
        count: result.data.count || 0
      });
    } else {
      res.json({ 
        success: true, 
        messages: [],
        count: 0
      });
    }
  } catch (err) {
    console.error('[ERROR] Notificaciones:', err.message);
    res.json({ 
      success: false, 
      error: 'Error obteniendo notificaciones',
      messages: [],
      count: 0
    });
  }
});

app.post('/marcar-leido', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.json({ success: false, error: 'Username requerido' });
  }

  try {
    const result = await commandService.execute(username, {
      command: 'MARK_AS_READ'
    });
    
    res.json(result);
  } catch (err) {
    console.error('[ERROR] Marcar leído:', err.message);
    res.json({ success: false, error: err.message });
  }
});

  console.log('✓ Rutas configuradas correctamente\n');
};
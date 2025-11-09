const validateRequired = (fields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    for (const field of fields) {
      // Buscar en body, query y params de forma segura
      const value = req.body?.[field] || req.query?.[field] || req.params?.[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos requeridos: ${missingFields.join(', ')}`
      });
    }
    
    next();
  };
};

const preventInjection = (req, res, next) => {
  const { message } = req.body;
  
  if (message && (message.includes('\n') || message.includes('\r'))) {
    return res.status(400).json({
      success: false,
      error: 'El mensaje no puede contener saltos de línea'
    });
  }
  
  next();
};

module.exports = { validateRequired, preventInjection };
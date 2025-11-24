#!/usr/bin/env node

/**
 * Script de verificación para diagnóstico del servidor ICE
 * Uso: node check-ice.js
 */

const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSuccess(msg) { log(`✅ ${msg}`, 'green'); }
function logError(msg) { log(`❌ ${msg}`, 'red'); }
function logWarning(msg) { log(`⚠️  ${msg}`, 'yellow'); }
function logInfo(msg) { log(`ℹ️  ${msg}`, 'cyan'); }

async function checkPort(host = 'localhost', port = 10000, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);
    
    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function runDiagnostics() {
  console.clear();
  log('\n╔════════════════════════════════════════════╗', 'blue');
  log('║   VERIFICADOR DE SERVIDOR ICE CHAT       ║', 'blue');
  log('╚════════════════════════════════════════════╝\n', 'blue');

  let issues = [];

  // ========================================================================
  // 1. Verificar estructura de directorios
  // ========================================================================
  log('\n[1/6] Verificando estructura de directorios...', 'cyan');
  
  const requiredDirs = [
    { path: 'cliente-web', name: 'Cliente Web' },
    { path: 'backend-java', name: 'Backend Java' },
    { path: 'cliente-web/js', name: 'JavaScript módulos' },
    { path: 'backend-java/server', name: 'Servidor Java' }
  ];

  for (const dir of requiredDirs) {
    if (fs.existsSync(dir.path)) {
      logSuccess(`${dir.name} encontrado: ${path.resolve(dir.path)}`);
    } else {
      logError(`${dir.name} NO encontrado: ${dir.path}`);
      issues.push(`Directorio faltante: ${dir.path}`);
    }
  }

  // ========================================================================
  // 2. Verificar archivos críticos
  // ========================================================================
  log('\n[2/6] Verificando archivos críticos...', 'cyan');
  
  const requiredFiles = [
    { path: 'cliente-web/js/iceClient.js', name: 'Cliente ICE' },
    { path: 'cliente-web/index.html', name: 'index.html' },
    { path: 'backend-java/server/build.gradle', name: 'build.gradle' },
    { path: 'backend-java/server/ChatSystem.ice', name: 'ChatSystem.ice' }
  ];

  for (const file of requiredFiles) {
    if (fs.existsSync(file.path)) {
      const stats = fs.statSync(file.path);
      logSuccess(`${file.name} encontrado (${stats.size} bytes)`);
    } else {
      logError(`${file.name} NO encontrado: ${file.path}`);
      issues.push(`Archivo faltante: ${file.path}`);
    }
  }

  // ========================================================================
  // 3. Verificar Ice.js en index.html
  // ========================================================================
  log('\n[3/6] Verificando Ice.js en index.html...', 'cyan');
  
  try {
    const indexPath = 'cliente-web/index.html';
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    if (indexContent.includes('ice.min.js') || indexContent.includes('Ice.js')) {
      logSuccess('Ice.js está importado en index.html');
    } else {
      logWarning('Ice.js NO está importado en index.html');
      logInfo('Agregando: <script src="https://cdnjs.cloudflare.com/ajax/libs/zeroc-ice/3.7.10/ice.min.js"></script>');
      issues.push('Ice.js no está en index.html');
    }
  } catch (err) {
    logError(`No se pudo leer index.html: ${err.message}`);
    issues.push('No se pudo verificar index.html');
  }

  // ========================================================================
  // 4. Verificar conectividad puerto 10000
  // ========================================================================
  log('\n[4/6] Verificando conectividad al puerto 10000...', 'cyan');
  
  const portOpen = await checkPort('localhost', 10000);
  
  if (portOpen) {
    logSuccess('Servidor ICE está corriendo en puerto 10000');
  } else {
    logError('Servidor ICE NO está corriendo en puerto 10000');
    logInfo('Para iniciar: cd backend-java/server && ./gradlew run');
    issues.push('Servidor ICE no está en ejecución');
  }

  // ========================================================================
  // 5. Verificar npm dependencies
  // ========================================================================
  log('\n[5/6] Verificando npm dependencies...', 'cyan');
  
  try {
    const packageJsonPath = 'cliente-web/package.json';
    if (fs.existsSync(packageJsonPath)) {
      const nodeModulesPath = 'cliente-web/node_modules';
      if (fs.existsSync(nodeModulesPath)) {
        logSuccess('node_modules instalado');
      } else {
        logWarning('node_modules no instalado');
        logInfo('Para instalar: cd cliente-web && npm install');
        issues.push('npm dependencies no instaladas');
      }
    }
  } catch (err) {
    logWarning(`No se pudo verificar npm: ${err.message}`);
  }

  // ========================================================================
  // 6. Verificar Java
  // ========================================================================
  log('\n[6/6] Verificando Java...', 'cyan');
  
  const javaCheck = new Promise((resolve) => {
    const java = spawn('java', ['-version']);
    let hasJava = false;
    
    java.stderr.on('data', (data) => {
      if (data.toString().includes('version')) {
        hasJava = true;
      }
    });
    
    java.on('close', () => {
      resolve(hasJava);
    });
    
    setTimeout(() => resolve(false), 2000);
  });

  const hasJava = await javaCheck;
  
  if (hasJava) {
    logSuccess('Java está instalado');
  } else {
    logError('Java NO está instalado o no está en PATH');
    logInfo('Descargalo de: https://www.oracle.com/java/technologies/downloads/');
    issues.push('Java no está disponible');
  }

  // ========================================================================
  // RESUMEN
  // ========================================================================
  log('\n' + '═'.repeat(45), 'blue');
  log('📋 RESUMEN FINAL', 'blue');
  log('═'.repeat(45), 'blue');

  if (issues.length === 0) {
    logSuccess('\n¡Todo está configurado correctamente! 🎉\n');
    log('Próximos pasos:', 'green');
    log('1. Inicia el servidor: cd backend-java/server && ./gradlew run', 'green');
    log('2. En otra terminal, inicia el cliente: cd cliente-web && npm start', 'green');
    log('3. Abre http://localhost:3000 en tu navegador\n', 'green');
  } else {
    logError(`\nEncontrados ${issues.length} problemas:\n`);
    issues.forEach((issue, i) => {
      log(`${i + 1}. ${issue}`, 'red');
    });
    log('\n');
  }

  log('═'.repeat(45) + '\n', 'blue');

  // Retornar código de salida
  return issues.length === 0 ? 0 : 1;
}

// Ejecutar
runDiagnostics().then(exitCode => process.exit(exitCode));
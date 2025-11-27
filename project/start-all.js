// start-all.js
const { spawn } = require('child_process');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(service, message, color = colors.reset) {
  console.log(`${color}[${service}]${colors.reset} ${message}`);
}

async function startAll() {
  console.log('\n' + colors.cyan + '╔════════════════════════════════════════╗');
  console.log('║     INICIANDO SISTEMA COMPU_NET       ║');
  console.log('╚════════════════════════════════════════╝' + colors.reset + '\n');

  const services = [];

  // 1. Iniciar servidor Ice (Java)
  log('Ice Server', 'Iniciando servidor Ice (puerto 10000)...', colors.blue);
  
  const isWindows = process.platform === 'win32';
  const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';
  
  const iceServer = spawn(gradleCmd, ['run'], {
    cwd: path.join(__dirname, 'backend-java', 'server'),
    shell: true
  });

  iceServer.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Ice Server', output, colors.blue);
  });

  iceServer.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('Picked up')) {
      log('Ice Server', output, colors.red);
    }
  });

  services.push({ name: 'Ice Server', process: iceServer });

  // Esperar 8 segundos para que Ice inicie completamente
  log('Ice Server', 'Esperando que el servidor Ice inicie...', colors.yellow);
  await new Promise(resolve => setTimeout(resolve, 8000));

  // 2. Iniciar cliente web (Vite/Webpack)
  log('Web Client', 'Iniciando cliente web (puerto 3000)...', colors.green);
  
  const webClient = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'cliente-web'),
    shell: true
  });

  webClient.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Web Client', output, colors.green);
  });

  webClient.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Web Client', output, colors.green); // Vite usa stderr para logs normales
  });

  services.push({ name: 'Web Client', process: webClient });

  // Esperar 3 segundos para que Vite compile
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Todo listo
  console.log('\n' + colors.green + '╔════════════════════════════════════════╗');
  console.log('║  ✓ TODOS LOS SERVICIOS INICIADOS      ║');
  console.log('╚════════════════════════════════════════╝' + colors.reset);
  
  console.log('\n' + colors.cyan + '📡 Servicios activos:');
  console.log('  • Ice Server:   ws://localhost:10000');
  console.log('  • Cliente Web:  http://localhost:3000' + colors.reset);
  
  console.log('\n' + colors.yellow + '🌐 Abre tu navegador en: ' + 
               colors.green + 'http://localhost:3000' + colors.reset);
  console.log('\n' + colors.yellow + 'Presiona Ctrl+C para detener todos los servicios\n' + colors.reset);

  // Manejar cierre
  const cleanup = () => {
    console.log('\n' + colors.yellow + '⏸️  Deteniendo servicios...' + colors.reset);
    services.forEach(service => {
      log(service.name, 'Deteniendo...', colors.yellow);
      service.process.kill();
    });
    setTimeout(() => {
      log('Sistema', 'Todos los servicios detenidos', colors.green);
      process.exit(0);
    }, 1000);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Iniciar todo
startAll().catch(error => {
  console.error(colors.red + '❌ Error fatal:', error.message + colors.reset);
  process.exit(1);
});
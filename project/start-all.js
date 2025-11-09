// start-all.js (C:\Users\luisg\Desktop\compunet\Compu_net\project\start-all.js)
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(service, message, color = colors.reset) {
  console.log(`${color}[${service}]${colors.reset} ${message}`);
}

function waitForService(port, serviceName, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, (res) => {
        clearInterval(interval);
        log(serviceName, `✓ Servicio listo en puerto ${port}`, colors.green);
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error(`Timeout esperando ${serviceName}`));
        }
      });
      req.end();
    }, 1000);
  });
}

async function startAll() {
  console.log('\n' + colors.cyan + '╔════════════════════════════════════════╗');
  console.log('║     INICIANDO SISTEMA COMPU_NET       ║');
  console.log('╚════════════════════════════════════════╝' + colors.reset + '\n');

  const services = [];

  // 1. Iniciar servidor Java TCP
  log('Java Server', 'Iniciando servidor TCP (puerto 9090)...', colors.blue);
  
  const isWindows = process.platform === 'win32';
  const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';
  
const javaServer = spawn(gradleCmd, [':server:run', '--console=plain'], {
    cwd: path.join(__dirname, 'backend-java'),
    shell: true
});

  javaServer.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Java Server', output, colors.blue);
  });

  javaServer.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('Picked up')) {
      log('Java Server', output, colors.red);
    }
  });

  services.push({ name: 'Java Server', process: javaServer });

  // Esperar a que el servidor Java inicie
  log('Java Server', 'Esperando que el servidor inicie...', colors.yellow);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 2. Iniciar proxy HTTP
  log('Proxy HTTP', 'Iniciando proxy HTTP (puerto 5000)...', colors.magenta);
  
  const proxy = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'proxy-http'),
    shell: true
  });

  proxy.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Proxy HTTP', output, colors.magenta);
  });

  proxy.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Proxy HTTP', output, colors.red);
  });

  services.push({ name: 'Proxy HTTP', process: proxy });

  // Esperar a que el proxy esté listo
  try {
    await waitForService(5000, 'Proxy HTTP');
  } catch (error) {
    log('Error', error.message, colors.red);
    services.forEach(s => s.process.kill());
    process.exit(1);
  }

  // 3. Iniciar servidor web para cliente
  log('Web Client', 'Iniciando servidor web (puerto 3000)...', colors.green);
  
  const webServer = spawn('npx', ['http-server', 'cliente-web', '-p', '3000', '-c-1'], {
    cwd: __dirname,
    shell: true
  });

  webServer.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Web Client', output, colors.green);
  });

  webServer.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log('Web Client', output, colors.red);
  });

  services.push({ name: 'Web Client', process: webServer });

  // Esperar a que el servidor web esté listo
  try {
    await waitForService(3000, 'Web Client');
  } catch (error) {
    log('Error', error.message, colors.red);
    services.forEach(s => s.process.kill());
    process.exit(1);
  }

  // Todo listo
  console.log('\n' + colors.green + '╔════════════════════════════════════════╗');
  console.log('║  ✓ TODOS LOS SERVICIOS INICIADOS      ║');
  console.log('╚════════════════════════════════════════╝' + colors.reset);
  
  console.log('\n' + colors.cyan + '📡 Servicios activos:');
  console.log('  • Java Server (TCP):  localhost:9090');
  console.log('  • Proxy HTTP:         http://localhost:5000');
  console.log('  • Cliente Web:        http://localhost:3000' + colors.reset);
  
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

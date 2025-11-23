# Instrucciones de Configuración Ice RPC para Compunet

## Requisitos Previos

1. **Java JDK 11 o superior**
2. **ZeroC Ice 3.7.x**
   - Descargar desde: https://zeroc.com/downloads/ice
   - Instalar Ice para Java y las herramientas (slice2java)
3. **Node.js 16 o superior**
4. **Gradle** (para compilar el backend Java)

## Configuración del Backend Java

### 1. Instalar ZeroC Ice

#### Windows:
\`\`\`bash
# Descargar el instalador MSI desde zeroc.com
# Agregar al PATH: C:\Ice-3.7.x\bin
\`\`\`

#### Linux/Mac:
\`\`\`bash
# Usando package manager
sudo apt-get install zeroc-ice-all-dev  # Ubuntu/Debian
brew install ice  # macOS
\`\`\`

### 2. Compilar Slice a Java

\`\`\`bash
cd project/backend-java
slice2java --output-dir server/src/main/java slice/Chat.ice
\`\`\`

### 3. Compilar y Ejecutar Servidor Ice

\`\`\`bash
cd project/backend-java
./gradlew :server:build
./gradlew :server:runIceServer
\`\`\`

El servidor Ice se ejecutará en:
- **Puerto:** 9099
- **Protocolo:** WebSocket (ws)
- **Endpoint:** ws://localhost:9099

## Configuración del Cliente Web

### 1. Instalar Dependencias

\`\`\`bash
cd project/cliente-web-ice
npm install
\`\`\`

### 2. Ejecutar en Modo Desarrollo

\`\`\`bash
npm run dev
\`\`\`

El cliente web se ejecutará en: http://localhost:3000

### 3. Compilar para Producción

\`\`\`bash
npm run build
\`\`\`

Los archivos compilados estarán en `dist/`

## Uso de la Aplicación

### Funcionalidades Implementadas

1. **Registro de Usuario**
   - Conecta al servidor Ice mediante WebSocket
   - Registra un observer para recibir mensajes en tiempo real

2. **Mensajes de Texto**
   - Envío de mensajes privados
   - Envío de mensajes a grupos
   - Actualización en tiempo real mediante callbacks Ice

3. **Notas de Voz**
   - Grabación de audio desde el navegador
   - Envío de audio mediante Ice RPC
   - Reproducción automática de mensajes de voz recibidos

4. **Grupos**
   - Creación de grupos
   - Unirse a grupos existentes
   - Mensajería grupal con notificaciones en tiempo real

5. **Historial**
   - Consulta de historial de conversaciones privadas
   - Consulta de historial de grupos
   - Persistencia en archivos JSON

## Arquitectura

### Backend (Java + Ice)

\`\`\`
IceServer.java
  ├─ ChatServiceImpl.java (implementa ChatService slice)
  ├─ HistoryManager.java (persistencia)
  └─ WebSocket endpoint (ws://localhost:9099)
\`\`\`

### Frontend (JavaScript + Ice)

\`\`\`
main.js
  ├─ IceChatClient.js (proxy Ice)
  │   └─ ChatObserverImpl.js (callbacks)
  ├─ AudioRecorder.js (grabación)
  └─ AudioPlayer.js (reproducción)
\`\`\`

## Diferencias con HTTP

| Característica | HTTP (proxy-http) | Ice RPC |
|---------------|-------------------|---------|
| Comunicación | Request/Response | Bidireccional |
| Tiempo Real | Polling | Callbacks automáticos |
| Protocolo | HTTP REST | Ice WebSocket |
| Tipado | JSON (sin tipos) | Slice (fuertemente tipado) |
| Audio | Base64 en JSON | Bytes nativos |

## Troubleshooting

### Error: "slice2java not found"
- Asegúrate de que Ice esté instalado y en el PATH
- Verifica: `slice2java --version`

### Error: "Failed to connect to Ice server"
- Verifica que el servidor Ice esté corriendo
- Comprueba el puerto 9099 esté libre
- Revisa la consola del servidor para errores

### Error de micrófono
- El navegador requiere HTTPS o localhost para acceder al micrófono
- Concede permisos cuando el navegador lo solicite

### Mensajes no se reciben en tiempo real
- Verifica que el observer esté registrado correctamente
- Revisa logs del servidor Ice para conexiones activas
- Comprueba la consola del navegador para errores de callbacks

## Próximos Pasos

1. **Autenticación**: Agregar sistema de login con contraseñas
2. **Cifrado**: Implementar cifrado end-to-end para mensajes
3. **Archivos**: Soporte para envío de imágenes y documentos
4. **Notificaciones**: Push notifications para mensajes nuevos
5. **UI Mejorada**: Diseño más moderno y responsive

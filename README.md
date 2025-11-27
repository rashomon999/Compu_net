# 📱 Sistema de Chat en Tiempo Real con ICE y WebSockets

## 👥 Integrantes del Equipo

- **Luis López**
- **Wilder Garcia**
- **Valentina Arana**

---

## 📋 Descripción General

Sistema de mensajería instantánea que implementa:

- ✅ **Chat privado y grupal** en tiempo real
- ✅ **Llamadas de voz VoIP** punto a punto
- ✅ **Notas de voz** con grabación y reproducción
- ✅ **Notificaciones push** mediante polling
- ✅ **Historial persistente** de conversaciones

**Tecnologías:**
- **Backend**: Java + ZeroC Ice + WebSockets
- **Frontend**: JavaScript (ES6+) + Web Audio API + Webpack
- **Protocolo**: Ice RPC sobre WebSocket

---

## 💻 Requisitos del Sistema

| Componente | Versión Mínima |
|------------|----------------|
| **Java JDK** | 11+ |
| **Node.js** | 14.x+ |
| **npm** | 6.x+ |
| **Gradle** | 7.x+ |

---

## 🚀 Instalación

### 1. Clonar el Repositorio
```bash
git clone <url-del-repositorio>
cd COMPU_NET
```

### 2. Instalar Dependencias del Backend
```bash
cd project/backend-java/server
./gradlew build
```

### 3. Instalar Dependencias del Cliente
```bash
cd ../../../cliente-web
npm install
```

---

## ▶️ Ejecución del Sistema

### Servidor Ice (Ejecutar una sola vez)
```bash
cd project/backend-java/server
./gradlew run
```

**Salida esperada:**
```
╔════════════════════════════════════════════╗
║    SERVIDOR ICE - SISTEMA DE CHAT         ║
╚════════════════════════════════════════════╝

[1/4] Inicializando componentes...
   ✓ HistoryManager inicializado
[2/4] Configurando adaptador ICE...
   ✓ Adaptador configurado en puerto 10000 (WebSocket)
[3/4] Registrando servicios ICE...
   ✓ ChatService registrado
   ✓ GroupService registrado
   ✓ NotificationService registrado
   ✓ VoiceService registrado
   ✓ AudioService registrado (llamadas VoIP)

╔════════════════════════════════════════════╗
║  ✓ SERVIDOR ICE LISTO                     ║
╚════════════════════════════════════════════╝

📡 WebSocket: ws://localhost:10000
```

### Cliente Web (Múltiples instancias)

En otra terminal:
```bash
cd cliente-web
npm run dev
```

**Salida esperada:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

Abre tu navegador en **http://localhost:3000**

**Nota:** Puedes abrir múltiples pestañas o navegadores para simular varios usuarios conectándose al mismo servidor.

---

## 🔄 Flujo de Comunicación Cliente-Servidor

### 1. Conexión Inicial
```
CLIENTE                                    SERVIDOR
  │                                           │
  │  1. Ice.initialize()                      │
  │     ws://localhost:10000                  │
  ├──────────────────────────────────────────►│
  │                                           │
  │  2. Obtener proxies de servicios:         │
  │     - ChatService                         │
  │     - NotificationService                 │
  │     - AudioService                        │
  ├──────────────────────────────────────────►│
  │                                           │
  │  3. subscribe(username, callback)         │
  ├──────────────────────────────────────────►│
  │                                           │
  │  4. attach(username, audioObserver)       │
  ├──────────────────────────────────────────►│
  │                                           │
  │  ✅ CONEXIÓN ESTABLECIDA                  │
  │◄──────────────────────────────────────────┤
```

### 2. Envío de Mensaje
```
CLIENTE A                    SERVIDOR                    CLIENTE B
    │                           │                            │
    │ sendPrivateMessage()      │                            │
    ├──────────────────────────►│                            │
    │  ("Alice", "Bob", "Hola") │                            │
    │                           │                            │
    │                           │  1. Guardar en             │
    │                           │     chat_history.json      │
    │                           │                            │
    │  SUCCESS                  │                            │
    │◄──────────────────────────┤                            │
    │                           │                            │
    │                           │  2. Encolar mensaje        │
    │                           │     para "Bob"             │
    │                           │                            │
    │                           │  3. getNewMessages()       │
    │                           │◄───────────────────────────┤
    │                           │     (polling cada 1s)      │
    │                           │                            │
    │                           │  4. Devolver mensaje       │
    │                           ├───────────────────────────►│
    │                           │     [Message{...}]         │
    │                           │                            │
    │                           │  5. Mostrar en UI          │
    │                           │                            ├─►💬
```

### 3. Sistema de Notificaciones (Polling)
```
CLIENTE                                    SERVIDOR
  │                                           │
  │  Cada 1 segundo:                          │
  │  getNewMessages(username)                 │
  ├──────────────────────────────────────────►│
  │                                           │
  │                                           │  Revisar cola
  │                                           │  de mensajes
  │                                           │  pendientes
  │                                           │
  │  Message[] (o vacío)                      │
  │◄──────────────────────────────────────────┤
  │                                           │
  │  Si hay mensajes:                         │
  │  - Actualizar lista de chats              │
  │  - Recargar historial si es chat actual   │
  │  - Mostrar notificación toast             │
```

---

## 🎯 Arquitectura de Llamadas VoIP

### Patrón de Diseño: Observer/Subject (basado en ejemplo del profesor)

Nuestra implementación sigue el patrón arquitectónico del proyecto de referencia:
```
Cliente 1 (Observer) ←→ Servidor (Subject) ←→ Cliente 2 (Observer)
```

**Componentes principales:**

1. **AudioSubject (Servidor)**
   - Mantiene mapa de `AudioObserverPrx` registrados
   - Enruta audio entre usuarios en llamada activa
   - Gestiona estado de llamadas con mapa bidireccional

2. **AudioObserver (Cliente)**
   - Recibe audio en tiempo real via `receiveAudio()`
   - Recibe notificaciones de llamadas (incoming/accepted/rejected/ended)
   - Implementado en `subscriber.js` (web) siguiendo el patrón del ejemplo

### Flujo de Llamada
```
Usuario A                    Servidor                    Usuario B
   │                            │                            │
   │──startCall("B")────────────►│                            │
   │                            │──incomingCall("A")────────►│
   │                            │                            │ (Usuario acepta)
   │                            │◄──acceptCall("A", "B")────│
   │◄──callAccepted("B")────────│                            │
   │                            │                            │
   │                    [Llamada Activa]                     │
   │──sendAudio(bytes)──────────►│──receiveAudio(bytes)──────►│
   │◄─────────────────sendAudio(bytes)◄──────────────────────│
   │                            │                            │
   │──hangup("B")────────────────►│──callEnded("A")──────────►│
```

### Enrutamiento de Audio (O(1))
```java
// Servidor mantiene mapa bidireccional
activeCalls.put("Alice", "Bob");   // Alice → Bob
activeCalls.put("Bob", "Alice");   // Bob → Alice

// Enrutamiento instantáneo
String target = activeCalls.get(fromUser);  // O(1)
AudioObserverPrx dest = observers.get(target);  // O(1)
dest.receiveAudioAsync(audioData);
```

**Flujo Actual (Servidor ICE)**
```java
java// ice/IceServer.java
public static void main(String[] args) {
    // 1. Crear servicios de negocio (tcp/)
    MessageService messageService = new MessageService(...);
    GroupService groupService = new GroupService(...);
    HistoryService historyService = new HistoryService(...);
    
    // 2. Crear servicios ICE que USAN los servicios de negocio
    ChatServiceI chatService = new ChatServiceI(messageService, historyService);
    GroupServiceI groupServiceICE = new GroupServiceI(groupService, ...);
    
    // 3. Registrar servicios ICE
    adapter.add(chatService, "ChatService");
    adapter.add(groupServiceICE, "GroupService");
}
```

### Diferencias con el Ejemplo Original

| Aspecto | Ejemplo Profesor | Nuestra Implementación |
|---------|------------------|------------------------|
| Cliente | Java Swing | JavaScript Web (HTML5 + Web Audio API) |
| Callbacks | JOptionPane | Modal HTML personalizado |
| Audio | javax.sound.sampled | Web Audio API (AudioContext) |
| Thread-safety | HashMap + synchronized | ConcurrentHashMap |
| Failsafe | Solo callbacks | Callbacks + polling (fallback) |
| Estadísticas | No | Contador de paquetes de audio |

### Mejoras Implementadas

1. **Sistema de Polling Fallback**: Si los callbacks de Ice fallan, el cliente puede consultar manualmente
2. **Estadísticas de Audio**: Tracking de paquetes enviados/recibidos para debugging
3. **Thread-Safety Mejorado**: Uso de `ConcurrentHashMap` para mejor concurrencia
4. **Limpieza Automática**: Desconexión detectada por `setCloseCallback()` limpia todos los recursos

---

## 📂 Estructura del Proyecto
```
COMPU_NET/
├── project/
│   └── backend-java/
│       └── server/
│           ├── src/main/java/
│           │   ├── ice/
│           │   │   ├── IceServer.java              (Punto de entrada)
│           │   │   └── services/
│           │   │       ├── AudioSubjectImpl.java   (VoIP)
│           │   │       ├── ChatServiceI.java       (Mensajería)
│           │   │       ├── NotificationServiceI.java (Polling)
│           │   │       ├── GroupServiceI.java
│           │   │       └── VoiceServiceI.java
│           │   └── utils/
│           │       └── HistoryManager.java         (Persistencia)
│           ├── AudioSubject.ice
│           ├── ChatSystem.ice
│           ├── build.gradle
│           └── chat_history.json
│
└── cliente-web/
    ├── js/
    │   ├── generated/
    │   │   ├── AudioSubject.js
    │   │   └── ChatSystem.js
    │   ├── iceClient.js         (Conexión Ice)
    │   ├── subscriber.js         (AudioObserver)
    │   ├── simpleAudioStream.js  (Captura/reproducción)
    │   ├── simpleCallManager.js  (Gestión llamadas)
    │   ├── notifications.js      (Polling)
    │   ├── messages.js
    │   ├── chats.js
    │   └── groups.js
    ├── index.html
    ├── style.css
    └── package.json
```

---

## 🔧 Solución de Problemas

### Error: "Cannot connect to localhost:10000"

**Verificar que el servidor está corriendo:**
```bash
netstat -an | grep 10000
```

**Si no aparece, reiniciar el servidor:**
```bash
cd project/backend-java/server
./gradlew run
```

### Audio no se escucha en llamadas

**1. Verificar permisos de micrófono en el navegador**

**2. Verificar logs del servidor:**
```
[AUDIO] acceptCall: Alice → Bob
   📞 Llamada BIDIRECCIONAL activa:
      Alice ↔ Bob
```

**3. En consola del navegador:**
```javascript
console.log('Call active:', simpleCallManager.activeCall);
console.log('Audio streaming:', simpleAudioStream.isActive());
```

### Mensajes no se actualizan automáticamente

**Verificar que el polling está activo** (en consola del navegador):
```
📬 [POLLING] Alice consultando mensajes...
```

---

## 📝 Características Implementadas

- ✅ Comunicación bidireccional Ice sobre WebSocket
- ✅ Patrón Observer/Subject para distribución de eventos
- ✅ Streaming de audio PCM16 @ 44.1kHz con baja latencia (~46ms)
- ✅ Sistema de notificaciones con polling (1 Hz)
- ✅ Persistencia JSON para historial
- ✅ Arquitectura modular cliente-servidor

---

**Versión:** 1.0.0  
**Fecha:** Enero 2025
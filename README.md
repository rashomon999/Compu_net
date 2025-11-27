# 📱 Sistema de Chat en Tiempo Real con ICE y WebSockets

## 👥 Integrantes del Equipo

- **Luis López**
- **Wilder Garcia**
- **Valentina Arana**

---

## 📋 Descripción General

Sistema de mensajería instantánea empresarial que implementa:

- ✅ **Chat privado y grupal** en tiempo real
- ✅ **Llamadas de voz VoIP** punto a punto con streaming de audio
- ✅ **Notas de voz** con grabación y reproducción
- ✅ **Notificaciones push** mediante callbacks ICE + polling (fallback)
- ✅ **Historial persistente** de conversaciones en JSON

**Stack Tecnológico:**
- **Backend**: Java 11+ con ZeroC Ice 3.7+ sobre WebSockets
- **Frontend**: JavaScript ES6+ con Web Audio API 
- **Protocolo**: Ice RPC bidireccional (ws://)
- **Persistencia**: JSON (HistoryManager)

---

## 🏗️ Arquitectura del Sistema

### Visión General (3 Capas)

```
┌─────────────────────────────────────────────────────────┐
│                  CLIENTE WEB (JS)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  UI Layer    │  │ Ice Proxies  │  │ Web Audio    │  │
│  │ (HTML/CSS)   │  │ (Generated)  │  │ API          │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ WebSocket (ws://)
┌─────────────────────────────────────────────────────────┐
│              SERVIDOR ICE (Java)                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ICE SERVICES LAYER (Adaptadores)               │   │
│  │  • ChatServiceI                                  │   │
│  │  • GroupServiceI                                 │   │
│  │  • NotificationServiceI (Callbacks + Polling)    │   │
│  │  • VoiceServiceI                                 │   │
│  │  • AudioSubjectImpl (VoIP - Patrón Observer)     │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  TCP SERVICES LAYER (Lógica de Negocio)         │   │
│  │  • MessageService (envío de mensajes)            │   │
│  │  • GroupService (gestión de grupos)              │   │
│  │  • HistoryService (consulta de historial)        │   │
│  │  • UserService (gestión de conexiones)           │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  STORAGE LAYER (Persistencia)                    │   │
│  │  • HistoryManager (chat_history.json)            │   │
│  │  • VoiceNoteStorage (archivos de audio)          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Separación de Responsabilidades

#### **Capa 1: ICE Services (Interfaz RPC)**
Los servicios ICE actúan como **adaptadores** que:
- Reciben llamadas RPC desde clientes web
- Validan parámetros
- Delegan lógica de negocio a los servicios TCP
- Retornan respuestas serializadas

**Ejemplo:**
```java
// ice/services/ChatServiceI.java
public String sendPrivateMessage(String sender, String recipient, String msg, Current current) {
    // ✅ Validación básica
    // ✅ Delega a MessageService (TCP)
    String result = messageService.sendPrivateMessage(sender, recipient, msg);
    // ✅ Envía notificaciones si hay éxito
    if (result.startsWith("SUCCESS") && notificationService != null) {
        notificationService.notifyNewMessage(recipient, msg);
    }
    return result;
}
```

#### **Capa 2: TCP Services (Lógica de Negocio)**
Implementan la **lógica real** del sistema:
- **MessageService**: Envío y entrega de mensajes
- **GroupService**: Creación, unión, gestión de grupos
- **HistoryService**: Consultas de historial y conversaciones recientes
- **UserService**: Tracking de usuarios conectados (TCP legacy)

**Ejemplo:**
```java
// tcp/MessageService.java
public String sendPrivateMessage(String sender, String recipient, String message) {
    // 1. Guardar en historial
    history.saveMessage(sender, recipient, "TEXT", message, false);
    
    // 2. Intentar entrega en tiempo real (legacy TCP)
    PrintWriter out = clients.get(recipient);
    if (out != null) {
        out.println("[" + sender + "]: " + message);
    }
    
    return "SUCCESS: Mensaje enviado";
}
```

#### **Capa 3: Storage (Persistencia)**
- **HistoryManager**: Lee/escribe `chat_history.json`
- **Thread-safe**: Usa `synchronized` para evitar corrupción
- **Formato JSON**: Estructura de conversaciones privadas y grupales

---

## 🔄 Flujos de Comunicación

### 1. Envío de Mensaje Privado (Completo)

```
┌─────────────┐                                 ┌─────────────┐
│  Cliente A  │                                 │  Cliente B  │
└──────┬──────┘                                 └──────┬──────┘
       │                                               │
       │  1. sendPrivateMessage("Alice", "Bob", "Hola")│
       ├──────────────────────►┌──────────────────┐   │
       │                       │  ChatServiceI    │   │
       │                       └────────┬─────────┘   │
       │                                │              │
       │                       ┌────────▼─────────┐   │
       │                       │  MessageService  │   │
       │                       │  (TCP Layer)     │   │
       │                       └────────┬─────────┘   │
       │                                │              │
       │                       ┌────────▼─────────┐   │
       │                       │  HistoryManager  │   │
       │                       │  (Guarda en JSON)│   │
       │                       └────────┬─────────┘   │
       │                                │              │
       │  2. "SUCCESS"                  │              │
       │◄───────────────────────────────┘              │
       │                                               │
       │  3. Notificación encolada                    │
       │     notificationService.notifyNewMessage()   │
       │                                ┌──────────────▼─┐
       │                                │ Polling activo │
       │                                │ cada 1 segundo │
       │                                └──────────────┬─┘
       │                                               │
       │                        4. getNewMessages()   │
       │                       ┌──────────────────────┤
       │                       │ Retorna: [Message{}] │
       │                       └──────────────────────►│
       │                                               │
       │                                5. Actualizar UI
       │                                   + Notificación
```

**Detalles técnicos:**

1. **Cliente A envía mensaje** via `iceClient.sendPrivateMessage()`
2. **ChatServiceI** valida y delega a **MessageService**
3. **MessageService** guarda en **HistoryManager** (JSON)
4. **MessageService** retorna `"SUCCESS: ..."` a **ChatServiceI**
5. **ChatServiceI** encola notificación para Cliente B
6. **Cliente B** hace polling (`getNewMessages()`) cada 1 segundo
7. **Cliente B** recibe mensaje, actualiza UI y recarga historial

### 2. Arquitectura de Notificaciones (Doble Sistema)

```
SISTEMA PRIMARIO: Callbacks ICE (Bidireccional)
┌────────────┐                        ┌────────────┐
│  Cliente   │  ◄──── callback ─────  │  Servidor  │
│            │  ─────► method call ──►│            │
└────────────┘                        └────────────┘
   ✅ Ventaja: Latencia baja (<100ms)
   ⚠️ Problema: Puede fallar en redes restrictivas

SISTEMA FALLBACK: Polling
┌────────────┐                        ┌────────────┐
│  Cliente   │  ────► getNewMessages()│  Servidor  │
│ (cada 1s)  │  ◄──── Message[]  ─────│   (Cola)   │
└────────────┘                        └────────────┘
   ✅ Ventaja: 100% confiable
   ⚠️ Problema: Latencia hasta 1 segundo
```

**Implementación:**

```java
// NotificationServiceI.java
public synchronized void notifyNewMessage(String username, Message msg) {
    // 1. Intentar callback (primario)
    NotificationCallbackPrx callback = subscribers.get(username);
    if (callback != null) {
        try {
            callback.onNewMessageAsync(msg); // ✅ Bidireccional
            return;
        } catch (Exception e) {
            System.err.println("⚠️ Callback falló, usando polling");
        }
    }
    
    // 2. Fallback: Encolar para polling
    messageQueues.computeIfAbsent(username, k -> new ArrayList<>()).add(msg);
}

public synchronized Message[] getNewMessages(String username, Current current) {
    List<Message> msgs = messageQueues.remove(username);
    return msgs != null ? msgs.toArray(new Message[0]) : new Message[0];
}
```

### 3. Llamadas VoIP (Patrón Observer/Subject del Profesor)

### Secuencia Completa:
```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Maria   │                    │ Servidor │                    │   Luis   │
│ (Cliente)│                    │  (Java)  │                    │ (Cliente)│
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │ 1. startCall("Luis")          │                               │
     │─────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. incomingCall("Maria")      │
     │                               │────────────────────────────>│
     │                               │                               │
     │                               │                  3. Usuario acepta
     │                               │                               │
     │                               │ 4. acceptCall("Maria", "Luis")│
     │                               │◄──────────────────────────────│
     │                               │                               │
     │ 5. callAccepted("Luis")       │                               │
     │◄─────────────────────────────│                               │
     │                               │                               │
     │ 6. Ambos inician streaming    │                               │
     │ startStreaming()              │          startStreaming()     │
     │                               │                               │
     │════════════════════════════AUDIO BIDIRECCIONAL════════════════│
     │                               │                               │
     │ sendAudio(data)               │                               │
     │─────────────────────────────>│                               │
     │                               │ receiveAudio(data)            │
     │                               │────────────────────────────>│
     │                               │                               │
     │                               │          sendAudio(data)      │
     │                               │◄──────────────────────────────│
     │ receiveAudio(data)            │                               │
     │◄─────────────────────────────│                               │
     │                               │                               │
     │════════════════════════════FIN DE LLAMADA═════════════════════│
     │                               │                               │
     │ hangup("Luis")                │                               │
     │─────────────────────────────>│                               │
     │                               │                               │
     │ callEnded("Maria")            │                               │
     │◄─────────────────────────────│                               │
     │                               │ callEnded("Maria")            │
     │                               │────────────────────────────>│
     │                               │                               │
     │ cleanup()                     │ cleanup()                     │
     │                               │                               │
```

**Clave del diseño:**

```java
// AudioSubjectImpl.java - Enrutamiento O(1)
public void sendAudio(String fromUser, byte[] data, Current current) {
    // PASO 1: Lookup instantáneo en mapa bidireccional
    String target = activeCalls.get(fromUser); // O(1)
    
    // PASO 2: Obtener proxy del destinatario
    AudioObserverPrx prx = observers.get(target); // O(1)
    
    // PASO 3: Enviar audio de forma asíncrona
    if (prx != null) {
        prx.receiveAudioAsync(data); // No bloquea
    }
}
```

**Por qué es bidireccional:**
```java
// acceptCall() establece AMBAS direcciones
activeCalls.put("Alice", "Bob");  // Alice → Bob
activeCalls.put("Bob", "Alice");  // Bob → Alice

// Ahora sendAudio() funciona en ambos sentidos:
// - Audio de Alice se enruta a Bob
// - Audio de Bob se enruta a Alice
```


# 🔄 Ice en tu Sistema: ¿Qué hace diferente el polling?

## HTTP + Polling normal

    [Cliente]                              [Servidor]
       |                                        |
       |------ GET /messages (TCP new) -------> |
       | <----- 200 OK (close) ---------------- |
       |                                        |
       ⏱️ 1 segundo
       |                                        |
       |------ GET /messages (TCP new) -------> |
       | <----- 200 OK (close) ---------------- |

➡️ **Cada request = una nueva conexión TCP**

---

## Ice + WebSocket Polling

    [Cliente]                               [Servidor]
       |                                         |
       |====== WS Handshake ====================>|
       |<===== Conexión WebSocket persistente ===|
       |                                         |
       |-- getNewMessages() [protocolo Ice] ---->|
       |<-- Message[] [binario] -----------------|
       |                                         |
       ⏱️ 1 segundo (MISMA conexión)
       |                                         |
       |-- getNewMessages() [protocolo Ice] ---->|
       |<-- Message[] [binario] -----------------|

➡️ **Una sola conexión WebSocket para TODO**

---

## 💻 Ice + WebSocket (Código)

```javascript
// Cliente mantiene UNA conexión WebSocket persistente
const proxy = await communicator.stringToProxy("ChatService:ws -h localhost -p 10000");
const chatService = await Ice.ChatServicePrx.checkedCast(proxy);

// Llamadas RPC sobre la MISMA conexión
const result = await chatService.sendPrivateMessage("Maria", "Luis", "Hola");

// Polling sobre conexión PERSISTENTE
setInterval(async () => {
    const newMessages = await notificationService.getNewMessages("Luis");
    // Datos ya tipados, sin parsing JSON
}, 1000);

---

## 💻 Requisitos del Sistema

| Componente | Versión Mínima | Propósito |
|------------|----------------|-----------|
| **Java JDK** | 11+ | Compilación del backend ICE |
| **Gradle** | 7.x+ | Build automation |
| **Node.js** | 14.x+ | Cliente web  |
| **npm** | 6.x+ | Gestión de dependencias JS |
| **ZeroC Ice** | 3.7+ | Middleware RPC (incluido en Gradle) |

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

**¿Qué hace esto?**
- Descarga ZeroC Ice 3.7
- Compila archivos `.ice` a Java
- Genera clases `ChatSystem.*` y `AudioSystem.*`
- Compila servicios ICE

### 3. Instalar Dependencias del Cliente
```bash
cd ../../../cliente-web
npm install
```

**¿Qué hace esto?**

- Instala Ice.js (cliente RPC para navegador)
- Configura WebSocket bindings

---

## ▶️ Ejecución del Sistema

### Paso 1: Iniciar Servidor ICE (Una sola vez)

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

### Paso 2: Iniciar Cliente(s) Web (Múltiples instancias)

**En otra(s) terminal(es):**
```bash
cd cliente-web
npm run dev
```

**Salida esperada:**
```

➜  Local:   http://localhost:3000/
```

**Para simular múltiples usuarios:**
- Abre varias pestañas del navegador
- O usa varios navegadores
- Todos se conectan al mismo servidor

---

## 📂 Estructura del Proyecto

```
COMPU_NET/
├── project/backend-java/server/
│   ├── src/main/java/
│   │   ├── ice/
│   │   │   ├── IceServer.java                 # ⭐ Punto de entrada
│   │   │   └── services/
│   │   │       ├── ChatServiceI.java          # Adaptador de mensajería
│   │   │       ├── GroupServiceI.java         # Adaptador de grupos
│   │   │       ├── NotificationServiceI.java  # Sistema de notificaciones
│   │   │       ├── VoiceServiceI.java         # Notas de voz
│   │   │       └── AudioSubjectImpl.java      # ⭐ VoIP (patrón Observer)
│   │   │
│   │   ├── tcp/                               # ⭐ CAPA DE LÓGICA DE NEGOCIO
│   │   │   ├── MessageService.java            # Envío de mensajes
│   │   │   ├── GroupService.java              # Gestión de grupos
│   │   │   ├── HistoryService.java            # Consultas de historial
│   │   │   └── UserService.java               # Gestión de conexiones
│   │   │
│   │   └── utils/
│   │       └── HistoryManager.java            # ⭐ Persistencia JSON
│   │       |__AudioFileManager.java  
│   ├── slice/                                 # Definiciones IDL
│   │   ├── ChatSystem.ice
│   │   └── AudioSubject.ice
│   │
│   ├── build.gradle                           # Configuración del build
│   └── chat_history.json                      # Base de datos
│
└── cliente-web/
    ├── js/
    │   ├── generated/                         # Código generado de .ice
    │   │   ├── ChatSystem.js
    │   │   └── AudioSubject.js
    │   │
    │   ├── iceClient.js                       # ⭐ Gestor de conexión ICE
    │   ├── subscriber.js                      # AudioObserver (cliente)
    │   ├── simpleAudioStream.js               # Captura/reproducción de audio
    │   ├── simpleCallManager.js               # Lógica de llamadas
    │   ├── notifications.js                   # Sistema de polling
    │   ├── auth.js                            # Login/logout
    │   ├── messages.js                        # Historial y envío
    │   ├── chats.js                           # Gestión de chats privados
    │   ├── groups.js                          # Gestión de grupos
    │   └── main.js                            # ⭐ Punto de entrada
    │
    ├── index.html
    ├── style.css
    ├── package.json
    └──
```

```
// IceServer.java
public static void main(String[] args) {
    // 1. Crear componentes
    HistoryManager historyManager = new HistoryManager();
    MessageService messageService = new MessageService(...);
    
    // 2. Crear servicios ICE
    ChatServiceI chatService = new ChatServiceI(messageService, ...);
    
    // 3. Registrar en Ice
    adapter.add(chatService, Util.stringToIdentity("ChatService"));
    
    // 4. Activar
    adapter.activate();
    communicator.waitForShutdown();
}
```

---

## 🌐 COMPONENTES DEL FRONTEND

### 📁 `cliente-web/`
```
cliente-web/
│
├── js/
│   ├── generated/              ← Código Ice generado (de .ice)
│   │   ├── AudioSubject.js     ← Generado de AudioSubject.ice
│   │   └── ChatSystem.js       ← Generado de ChatSystem.ice
│   │
│   ├── iceClient.js            ← Cliente Ice (conexión al servidor)
│   ├── subscriber.js           ← Implementación de AudioObserver
│   ├── simpleAudioStream.js    ← Captura/reproducción de audio
│   ├── simpleCallManager.js    ← Gestión de llamadas
│   ├── auth.js                 ← Login/logout
│   ├── chats.js                ← UI de chats
│   ├── messages.js             ← Envío/recepción de mensajes
│   └── ...
│
├── index.html                  ← HTML principal
├── style.css                   ← Estilos
└── webpack.config.js           ← Configuración de build
```

---

## 🔄 FLUJO COMPLETO: FRONTEND ↔ BACKEND

### Ejemplo: Envío de Mensaje
```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  (cliente-web/)                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. Usuario escribe mensaje
                              │
                    ┌─────────▼──────────┐
                    │   messages.js      │
                    │  sendMessage()     │
                    └─────────┬──────────┘
                              │
                              │ 2. Llama a Ice
                              │
                    ┌─────────▼──────────┐
                    │   iceClient.js     │
                    │  sendPrivateMsg()  │
                    └─────────┬──────────┘
                              │
                              │ 3. WebSocket
                              │    (Ice protocolo)
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                         BACKEND                                 │
│  (backend-java/server/)                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  ChatServiceI.java │  ← ice/services/
                    │  (Capa ICE)        │
                    └─────────┬──────────┘
                              │
                              │ 4. Delega a negocio
                              │
                    ┌─────────▼──────────┐
                    │ MessageService.java│  ← tcp/
                    │  (Lógica negocio)  │
                    └─────────┬──────────┘
                              │
                              │ 5. Guarda en disco
                              │
                    ┌─────────▼──────────┐
                    │ HistoryManager.java│  ← utils/
                    │  (Persistencia)    │
                    └────────────────────┘
```

---

## 📊 RESUMEN VISUAL
```
┌──────────────────────────────────────────────────────────────┐
│                        TU PROYECTO                           │
└──────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    ┌─────────────┐                ┌─────────────┐
    │  FRONTEND   │   WebSocket    │   BACKEND   │
    │  (cliente)  │◄──────────────►│  (servidor) │
    └─────────────┘                └─────────────┘
           │                               │
           │                               │
    ┌──────┴──────┐              ┌────────┴────────┐
    │             │              │                 │
    ▼             ▼              ▼                 ▼
┌─────┐     ┌─────┐      ┌──────────┐     ┌──────────┐
│HTML │     │ JS  │      │ice/      │     │tcp/      │
│CSS  │     │     │      │services/ │     │(negocio) │
└─────┘     │     │      │          │     │          │
            │     │      │ ├─Audio  │     │├─Message │
            │     │      │ ├─Chat   │     │├─Group   │
            │     │      │ ├─Group  │     │└─History │
            │     │      │ ├─Notif  │     │          │
            │     │      │ └─Voice  │     │          │
            │     │      └──────────┘     └──────────┘
            │     │              │
            │     │              ▼
            │     │      ┌──────────┐
            │     │      │utils/    │
            │     │      │          │
            │     │      │├─History │
            │     │      │└─Audio   │
            │     │      └──────────┘
            ▼     ▼
      ┌──────────────┐
      │ subscriber.js│  ← Implementa AudioObserver
      │ iceClient.js │  ← Conecta con servidor
      │ simpleAudio* │  ← Streaming
      └──────────────┘
```

---

## ✅ CONCLUSIÓN

### **Backend (Servidor Java):**
```
backend-java/server/
├── ice/services/     ← ✅ Sí, parte del servidor (capa ICE)
├── tcp/              ← ✅ Lógica de negocio
├── utils/            ← ✅ Utilidades
└── IceServer.java    ← ✅ Main del servidor
```

### **Frontend (Cliente Web):**
```
cliente-web/
├── js/               ← ✅ Lógica del cliente
├── index.html        ← ✅ UI
└── style.css         ← ✅ Estilos

---

## 🔧 Solución de Problemas

### Error: "Cannot connect to localhost:10000"

**1. Verificar que el servidor está corriendo:**
```bash
netstat -an | grep 10000
```

**Salida esperada:**
```
tcp6  0  0  :::10000  :::*  LISTEN
```

**Si no aparece:**
```bash
cd project/backend-java/server
./gradlew run
```

### Audio no se escucha en llamadas

**1. Verificar permisos de micrófono:**
- Chrome/Edge: `chrome://settings/content/microphone`
- Firefox: `about:preferences#privacy` → Permisos

**2. Verificar logs del servidor:**
```
[AUDIO] acceptCall: Alice → Bob
   📞 Llamada BIDIRECCIONAL activa:
      Alice ↔ Bob
   🔊 Enrutamiento de audio configurado
```

**3. En consola del navegador (F12):**
```javascript
console.log('Call active:', simpleCallManager.activeCall);
console.log('Streaming:', simpleAudioStream.isActive());
```

**Esperado:**
```
Call active: {type: "OUTGOING", status: "CONNECTED", ...}
Streaming: true
```

### Mensajes no se actualizan automáticamente

**Verificar polling en consola:**
```
📬 [POLLING] Alice consultando mensajes...
```

**Si no aparece:**
1. Verificar `notifications.js` está cargado
2. Revisar errores en Network tab (F12)
3. Reiniciar servidor



---

```
BACKEND COMPLETO = ice/services/ + tcp/ + utils/ + IceServer.java
                   ↑               ↑      ↑       ↑
                   Capa ICE       Negocio Utils   Main
```


## 📝 Características Implementadas

### ✅ Funcionalidades Core

- **Mensajería**
  - [x] Chat privado 1:1
  - [x] Grupos multi-usuario
  - [x] Historial persistente
  - [x] Formato de timestamp

- **Notificaciones**
  - [x] Callbacks ICE bidireccionales (primario)
  - [x] Polling cada 1 segundo (fallback)
  - [x] Notificaciones toast en UI
  - [x] Sonido de alerta

- **Notas de Voz**
  - [x] Grabación (Web Audio API)
  - [x] Almacenamiento en Base64
  - [x] Reproducción inline
  - [x] Máximo 30 segundos

- **Llamadas VoIP**
  - [x] Patrón Observer/Subject
  - [x] Streaming PCM16 @ 44.1kHz
  - [x] Latencia < 50ms
  - [x] Enrutamiento O(1)
  - [x] Detección de desconexión

### 🛠️ Tecnologías Clave

- **Ice RPC sobre WebSocket**: Comunicación bidireccional
- **Web Audio API**: Captura y reproducción de audio
- **ScriptProcessor**: Procesamiento de audio en tiempo real
- **ConcurrentHashMap**: Thread-safety en servidor
- **JSON**: Persistencia simple y legible

---

## 📚 Referencias

- [ZeroC Ice Documentation](https://doc.zeroc.com/ice/3.7)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- Patrón Observer/Subject adaptado del proyecto de referencia del profesor

---

**Versión:** 1.0.0  
**Fecha:** Enero 2025  
**Licencia:** MIT
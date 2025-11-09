<<<<<<< HEAD
# Proyecto: Chat TCP con Mensajes de Voz y Texto

### Autores:
**Luis**, **Wilder**, **Valentina**

---

### Lenguaje y Tecnologías
- **Lenguaje:** Java 
- **Tecnologías:** TCP Sockets, GSON, Java Sound API 

---

## Descripción General

Este proyecto implementa un **sistema de chat en red** con soporte para:

✅ Comunicación entre múltiples clientes 

✅ Envío y recepción de mensajes de texto  

✅ Envío y reproducción de notas de voz  

✅ Historial de chat persistente en JSON  

✅ Grupos de chat con gestión de miembros  

✅ Gestión de archivos de audio (guardar, listar, eliminar)

El sistema utiliza **Sockets TCP** para la comunicación y **Object Streams** (`ObjectInputStream` / `ObjectOutputStream`) para transmitir objetos serializados como `String` o `VoiceMessage`.

---

## Arquitectura del Proyecto

### Servidor (`Server.java`)
- Escucha conexiones entrantes por el **puerto 9090**  
- Mantiene un registro de clientes conectados  
- Redirige los mensajes (de texto o voz) al destinatario o grupo  
- Guarda el historial de mensajes y audios mediante `HistoryManager` y `AudioFileManager`

### Cliente (`Client.java`)
- Se conecta al servidor con un nombre de usuario  
- Envía y recibe mensajes  
- Graba notas de voz con `AudioCapturer`  
- Reproduce notas de voz con `AudioPlayer`  
- Soporta mensajes individuales o grupales  

---

## Estructura del Código

src/main/java
├── tcp/
│ ├── ClientHandler.java
│ ├── Server.java
│
├── udp/
│ └── UDPVoiceServer.java
│
├── utils/
│ ├── AudioCapturer.java
│ ├── AudioFileManager.java
│ ├── AudioPlayer.java
│ ├── HistoryManager.java
│ ├── MessageProtocol.java
│ ├── VoiceMessage.java
│ └── Config.java
│
└── audio_files/ # Carpeta donde se guardan los audios (.wav)

---

##  Funcionamiento del Sistema

### Inicio del Servidor

$ java tcp.Server

### Salida esperada:

SERVIDOR DE CHAT INICIADO
Puerto TCP: 9090
Esperando conexiones...

### Conexión del Cliente

Cada cliente se conecta ingresando su nombre de usuario y la IP del servidor.

El servidor registra la conexión y empieza a escuchar los mensajes enviados.

### Envío de Mensajes de Texto

Los mensajes se envían como cadenas (String) y se registran en chat_history.json.

Ejemplo:
[PRIVADO] [2025-10-13 11:24:01] Luis → Valentina: ¡Hola! ¿Cómo estás?

### Envío de Mensajes de Voz

Los mensajes de voz se capturan con el micrófono usando AudioCapturer y se envían como objetos VoiceMessage.

### El servidor:

Guarda el archivo .wav en audio_files/

Registra una entrada en el historial con [AUDIO_FILE:nombre.wav]

Reenvía el audio al destinatario o grupo

Ejemplo:
[GRUPO: Amigos] [2025-10-13 11:27:45] Luis → Todos: [NOTA DE VOZ] (Luis_to_Amigos_20251013_112745.wav)
Reproducción de Audio

El cliente usa AudioPlayer para reproducir los mensajes de voz:

Reproduciendo nota de voz de Luis (4.5 segundos)

### Grupos de Chat

- Los grupos se gestionan desde HistoryManager.

- Los miembros se almacenan en groups.json.

- Cada mensaje grupal incluye el nombre del grupo y la marca [GRUPO].

### Archivos JSON Generados

- Archivo	Descripción

- chat_history.json	Contiene todos los mensajes enviados y recibidos

- groups.json	Lista de grupos creados con sus miembros

- audio_files/	Carpeta donde se almacenan las notas de voz (.wav)

### Clases Principales

Clase y su	Rol Principal

Server - 	Acepta conexiones y redirige mensajes

ClientHandler	- Controla la comunicación con un cliente

VoiceMessage - Representa un mensaje de voz serializable

AudioCapturer -	Graba audio desde el micrófono

AudioPlayer -	Reproduce archivos de audio

HistoryManager -	Registra, guarda y elimina mensajes

AudioFileManager -	Administra los archivos de audio (.wav)

Config -	Configura los parámetros de red (host, puerto)

### Ejecución Rápida

Compilar el proyecto:

- javac -d bin src/**/*.java

Iniciar el servidor:

- java -cp bin tcp.Server

Iniciar un cliente:

- java -cp bin tcp.Client

Enviar mensajes o grabar notas de voz desde la consola.

### Eliminar Historial

Para eliminar el historial de un usuario (mensajes y audios):

- history.deleteUserHistory("Luis");
  
Esto borra los mensajes del JSON y los archivos de audio asociados.

## Conclusión 

Este proyecto demuestra el uso combinado de:

- Comunicación entre procesos con Sockets TCP

- Serialización de objetos Java

- Persistencia con JSON (GSON)

- Procesamiento de audio con Java Sound API

- Es una implementación sólida de un chat multimedia distribuido, aplicando concurrencia, persistencia y comunicación en red.
=======
# 💬 COMPU_NET - Sistema de Chat TCP/HTTP

### 👥 Autores
**Luis García**, **Wilder**, **Valentina**

 

---
## 📋 Descripción General

Sistema de chat distribuido que evoluciona desde una arquitectura **Cliente-Servidor TCP** (Tarea 1) hacia una **arquitectura web con proxy HTTP** (Tarea 2), manteniendo la compatibilidad con el backend original en Java.

### Características Principales

✅ Mensajería de texto en tiempo real  
✅ Creación y gestión de grupos  
✅ Historial persistente de conversaciones  
✅ Cliente web moderno (HTML/CSS/JavaScript)  
✅ Arquitectura escalable con proxy HTTP  
✅ Soporte para notas de voz y llamadas (Cliente Java - Tarea 1)  

---

## 🏗️ Arquitectura del Sistema
```
┌─────────────────┐      HTTP         ┌─────────────────┐      TCP          ┌─────────────────┐
│  CLIENTE WEB    │ ←───────────────→ │   PROXY HTTP    │ ←───────────────→ │  SERVIDOR JAVA  │
│   (Browser)     │   JSON/REST       │   (Express)     │   Texto plano     │     (TCP)       │
│   Puerto 3000   │                   │   Puerto 5000   │                   │   Puerto 9090   │
└─────────────────┘                   └─────────────────┘                   └─────────────────┘
```

### Flujo de Comunicación

1. **Cliente Web** envía petición HTTP (JSON) al proxy
2. **Proxy HTTP** traduce a comandos TCP y se conecta al servidor Java
3. **Servidor Java** procesa el comando y persiste los datos
4. La respuesta viaja de vuelta: Java → Proxy → Cliente Web

---

## 📂 Estructura del Proyecto
```
COMPU_NET/
│
├── backend-java/              # Servidor TCP (Java)
│   ├── server/
│   │   └── src/main/java/
│   │       ├── tcp/
│   │       │   ├── Server.java           ⭐ Servidor principal
│   │       │   └── TextClientHandler.java ⭐ Manejo de conexiones
│   │       └── utils/
│   │           ├── HistoryManager.java   ⭐ Persistencia JSON
│   │           └── MessageProtocol.java   Protocol definitions
│   ├── client/                # Cliente Java (Tarea 1 - legacy)
│   │   └── src/main/java/tcp/
│   │       └── Client.java
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradlew / gradlew.bat
│
├── proxy-http/                # Proxy HTTP (Node.js + Express)
│   ├── src/
│   │   └── index.js          ⭐ Traducción HTTP ↔ TCP
│   ├── package.json
│   └── node_modules/
│
├── cliente-web/               # Cliente Web (HTML/JS/CSS)
│   ├── index.html            ⭐ Interfaz de usuario
│   ├── script.js             ⭐ Lógica del cliente
│   ├── style.css              Estilos visuales
│   ├── chat_history.json      Historial (auto-generado)
│   └── groups.json            Grupos (auto-generado)
│
├── start-all.js              ⭐ Script de inicio automático
├── package.json               Configuración raíz
└── README.md                  Este archivo
```

---

## 🚀 Instalación y Configuración

### Requisitos Previos

| Software | Versión Mínima | Verificar |
|----------|----------------|-----------|
| Java (JDK) | 17+ | `java -version` |
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Gradle | 7+ | `./gradlew -v` |

### Instalación
```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd COMPU_NET

# 2. Instalar dependencias del proxy
cd proxy-http
npm install
cd ..

# 3. Instalar dependencias raíz (para start-all.js)
npm install

# 4. Verificar configuración de Java
cd backend-java
./gradlew build
cd ..
```

---

## ▶️ Ejecución del Sistema

### Opción 1: Inicio Automático (Recomendado) 🎯

Inicia **todos los servicios** con un solo comando:
```bash
npm start
```

**Salida esperada:**
```
╔════════════════════════════════════════╗
║     INICIANDO SISTEMA COMPU_NET       ║
╚════════════════════════════════════════╝

[Java Server] Iniciando servidor TCP (puerto 9090)...
[Java Server] ✓ Servidor TCP iniciado
[Proxy HTTP] Iniciando proxy HTTP (puerto 5000)...
[Proxy HTTP] ✓ Servicio listo en puerto 5000
[Web Client] Iniciando servidor web (puerto 3000)...
[Web Client] ✓ Servicio listo en puerto 3000

╔════════════════════════════════════════╗
║  ✓ TODOS LOS SERVICIOS INICIADOS      ║
╚════════════════════════════════════════╝

📡 Servicios activos:
  • Java Server (TCP):  localhost:9090
  • Proxy HTTP:         http://localhost:5000
  • Cliente Web:        http://localhost:3000

🌐 Abre tu navegador en: http://localhost:3000

Presiona Ctrl+C para detener todos los servicios
```

### Opción 2: Inicio Manual (Paso a Paso)

**Terminal 1 - Servidor Java:**
```bash
cd backend-java
./gradlew :server:run

# Windows:
gradlew.bat :server:run
```

**Terminal 2 - Proxy HTTP:**
```bash
cd proxy-http
npm start
```

**Terminal 3 - Cliente Web:**
```bash
cd cliente-web
npx http-server -p 3000 -c-1

# O si tienes http-server instalado globalmente:
http-server -p 3000 -c-1
```

### Opción 3: Cliente Java (Tarea 1 - Legacy)

Para usar el cliente original de consola:
```bash
cd backend-java
./gradlew :client:run
```

---

## 📱 Uso del Sistema

### 1. Acceder al Cliente Web

1. Abre tu navegador en: **http://localhost:3000**
2. Ingresa tu nombre de usuario
3. Click en **"Conectar"**

### 2. Funcionalidades Disponibles

#### 💬 Chats Privados
```
1. Click en tab "Chats"
2. Ingresa el nombre del usuario destinatario
3. Click en "Abrir"
4. Escribe tu mensaje y presiona Enter o "Enviar"
```

#### 👥 Grupos
```
1. Click en tab "Grupos"
2. Para crear: Ingresa nombre y click "Crear"
3. Para unirse: Ingresa nombre existente y click "Unirse"
4. Selecciona el grupo del listado
5. Envía mensajes al grupo
```

#### 📜 Historial
```
- El historial se muestra automáticamente al abrir un chat
- Se actualiza cada 3 segundos (polling)
- Persiste en chat_history.json y groups.json
```

---

## 🔧 Protocolo de Comunicación

### Comandos TCP (Servidor Java)

| Comando | Formato | Descripción |
|---------|---------|-------------|
| `REGISTER` | `REGISTER <username>` | Registrar usuario |
| `MSG_USER` | `MSG_USER <destino> <mensaje>` | Mensaje privado |
| `MSG_GROUP` | `MSG_GROUP <grupo> <mensaje>` | Mensaje grupal |
| `CREATE_GROUP` | `CREATE_GROUP <nombre>` | Crear grupo |
| `JOIN_GROUP` | `JOIN_GROUP <nombre>` | Unirse a grupo |
| `LIST_GROUPS` | `LIST_GROUPS` | Listar grupos |
| `LIST_USERS` | `LIST_USERS` | Listar usuarios |
| `VIEW_HISTORY` | `VIEW_HISTORY <usuario>` | Ver historial |
| `VIEW_GROUP_HISTORY` | `VIEW_GROUP_HISTORY <grupo>` | Historial grupal |

### Endpoints HTTP (Proxy)

| Método | Endpoint | Body | Descripción |
|--------|----------|------|-------------|
| POST | `/register` | `{username}` | Registrar usuario |
| POST | `/enviar` | `{from, to, message}` | Mensaje privado |
| POST | `/enviar-grupo` | `{from, grupo, message}` | Mensaje grupal |
| POST | `/grupos` | `{nombre, creator}` | Crear grupo |
| POST | `/grupos/unirse` | `{grupo, username}` | Unirse a grupo |
| GET | `/grupos?username=X` | - | Listar grupos |
| GET | `/historial/:usuario?from=X` | - | Ver historial |
| GET | `/historial-grupo/:grupo?username=X` | - | Historial grupo |
| GET | `/health` | - | Health check |

---

## 📊 Ejemplo de Flujo Completo

### Envío de Mensaje: Luis → Ana
```javascript
// 1️⃣ Cliente Web (script.js)
fetch('http://localhost:5000/enviar', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    from: "Luis",
    to: "Ana",
    message: "Hola!"
  })
})

// 2️⃣ Proxy HTTP (index.js) traduce a:
socket.write("REGISTER Luis\n")
socket.write("MSG_USER Ana Hola!\n")

// 3️⃣ Servidor Java (TextClientHandler.java) ejecuta:
processCommand("MSG_USER Ana Hola!")
  → sendMessageToUser("Ana", "Hola!")
    → history.saveMessage("Luis", "Ana", "TEXT", "Hola!", false)
    → out.println("SUCCESS: Mensaje enviado a Ana")

// 4️⃣ Proxy devuelve a Cliente Web:
{
  "success": true,
  "message": "SUCCESS: Mensaje enviado a Ana",
  "timestamp": "2025-11-08T10:30:00.000Z"
}
```

---

## 🗂️ Archivos Generados

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| `chat_history.json` | `backend-java/` | Historial de mensajes |
| `groups.json` | `backend-java/` | Grupos y miembros |
| `audio_files/*.wav` | `backend-java/` | Notas de voz (Tarea 1) |

### Ejemplo de `chat_history.json`
```json
[
  {
    "sender": "Luis",
    "recipient": "Ana",
    "type": "TEXT",
    "content": "Hola!",
    "isGroup": false,
    "timestamp": "2025-11-08 10:30:00"
  }
]
```

### Ejemplo de `groups.json`
```json
{
  "Proyecto": {
    "name": "Proyecto",
    "creator": "Luis",
    "members": ["Luis", "Wilder", "Valentina"],
    "createdAt": "2025-11-08 09:00:00"
  }
}
```

---

## 🛠️ Tecnologías Utilizadas

### Backend (Java)
- **Java 17+** - Lenguaje principal
- **TCP Sockets** - Comunicación en red
- **Gradle** - Build automation
- **GSON** - Serialización JSON
- **Java Sound API** - Procesamiento de audio (Tarea 1)

### Proxy (Node.js)
- **Node.js 18+** - Runtime JavaScript
- **Express 5** - Framework web
- **net** - Cliente TCP nativo
- **cors** - Cross-Origin Resource Sharing

### Frontend (Web)
- **HTML5** - Estructura
- **CSS3** - Estilos modernos
- **JavaScript (ES6+)** - Lógica cliente
- **Fetch API** - Peticiones HTTP

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to server"
```bash
# Verificar que el servidor Java esté corriendo:
netstat -an | grep 9090

# Reiniciar servidor:
cd backend-java
./gradlew :server:run
```

### Error: "Proxy not responding"
```bash
# Verificar que el proxy esté corriendo:
curl http://localhost:5000/health

# Reinstalar dependencias:
cd proxy-http
rm -rf node_modules
npm install
npm start
```

### Error: "Port already in use"
```bash
# Windows - Liberar puerto:
netstat -ano | findstr :9090
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:9090 | xargs kill -9
```

### Los mensajes no se actualizan automáticamente
- **Comportamiento normal**: HTTP no tiene comunicación en tiempo real
- **Solución actual**: Polling cada 3 segundos en `script.js`
- **Mejora futura**: Implementar WebSockets (Proyecto Final)

---

## 📈 Diferencias entre Tarea 1 y Tarea 2

| Aspecto | Tarea 1 (TCP) | Tarea 2 (HTTP) |
|---------|---------------|----------------|
| **Cliente** | Java (Consola) | HTML/JS (Web) |
| **Protocolo** | TCP directo | HTTP → Proxy → TCP |
| **Serialización** | ObjectOutputStream | JSON |
| **Tiempo real** | Sí (sockets persistentes) | No (polling manual) |
| **Notas de voz** | ✅ Soportadas | ❌ Excluidas |
| **Llamadas** | ✅ UDP | ❌ Excluidas |
| **Interfaz** | Terminal | Navegador web |

---

## 🚧 Limitaciones Conocidas (Tarea 2)

- ❌ **Sin mensajes en tiempo real**: Requiere refrescar o esperar polling
- ❌ **Sin notas de voz**: Será implementado con WebSockets (Proyecto Final)
- ❌ **Sin llamadas**: Será implementado con WebRTC (Proyecto Final)
- ⚠️ **Polling cada 3s**: Puede causar latencia en mensajes

---

## 🔮 Mejoras Futuras (Proyecto Final)

- [ ] Migrar a WebSockets para comunicación bidireccional
- [ ] Implementar notificaciones push en tiempo real
- [ ] Agregar soporte de notas de voz en cliente web
- [ ] Implementar llamadas de voz con WebRTC
- [ ] Cifrado end-to-end de mensajes
- [ ] Autenticación con JWT
- [ ] Base de datos (PostgreSQL/MongoDB)
- [ ] Interfaz responsive (mobile-first)

---

## 📚 Referencias

- [Java Socket Programming](https://docs.oracle.com/javase/tutorial/networking/sockets/)
- [Express.js Documentation](https://expressjs.com/)
- [Fetch API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [GSON User Guide](https://github.com/google/gson/blob/master/UserGuide.md)

---

## 📞 Contacto y Soporte

Si tienes preguntas o problemas:

1. Revisa la sección **Solución de Problemas**
2. Verifica los logs en cada terminal
3. Contacta al equipo de desarrollo

---

## 📄 Licencia

Este proyecto es parte de un trabajo académico para la materia de Redes de Computadoras.

---

## 🎓 Conclusión

Este proyecto demuestra la transición exitosa de una arquitectura **Cliente-Servidor TCP pura** hacia un **sistema web moderno con proxy HTTP**, manteniendo la compatibilidad con el backend original y preparando el terreno para futuras mejoras con WebSockets y tecnologías web avanzadas.

### Conceptos Aprendidos

✅ Comunicación TCP/IP con sockets  
✅ Arquitectura de microservicios (Cliente → Proxy → Servidor)  
✅ Traducción de protocolos (HTTP ↔ TCP)  
✅ Persistencia de datos con JSON  
✅ Concurrencia y manejo de múltiples conexiones  
✅ Desarrollo full-stack (Java + Node.js + JavaScript)  

---

**Última actualización:** Noviembre 2025  
**Versión:** 2.0 (Tarea 2)
>>>>>>> 9f0d85c69bb03729d031960d6f75e67b58d4abbf

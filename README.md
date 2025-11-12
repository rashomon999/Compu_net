# 💬 COMPU_NET - Sistema de Chat TCP/HTTP

### 👥 Autores
**Luis**, **Wilder**, **Valentina**

 

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
```

COMPU_NET/
│
├── backend-java/                          # Servidor TCP (Java)
│   ├── client/                            # Cliente Java (legacy - Tarea 1)
│   │   └── src/main/java/
│   │       ├── tcp/
│   │       │   └── Client.java            ⭐ Cliente TCP (modo texto)
│   │       └── utils/
│   │           ├── AudioCapturer.class    # Captura de audio (voz)
│   │           ├── AudioPlayer.class      # Reproducción de audio
│   │           └── VoiceMessage.java      # Mensajes de voz (definición)
│   │
│   ├── server/                            # Servidor principal TCP y UDP
│   │   ├── audio_files/                   # Carpeta para archivos de voz
│   │   ├── src/main/java/
│   │   │   ├── tcp/                       # Módulo TCP principal
│   │   │   │   ├── GroupService.java      # Servicio para manejo de grupos
│   │   │   │   ├── HistoryService.java    # Manejo de historial de mensajes
│   │   │   │   ├── MessageService.java    # Lógica de envío/recepción de mensajes
│   │   │   │   ├── Server.java            ⭐ Servidor TCP principal
│   │   │   │   ├── TextClientHandler.java # Gestión de clientes conectados
│   │   │   │   └── UserService.java       # Manejo de usuarios
│   │   │   ├── udp/
│   │   │   │   └── UDPVoiceServer.java    # Servidor de voz (UDP)
│   │   │   └── utils/
│   │   │       └── Config.java            # Configuración del servidor
│   │   ├── chat_history.json              # Historial de mensajes global
│   │   ├── groups.json                    # Datos de grupos globales
│   │   ├── build.gradle
│   │   ├── config.json                    # Configuración general (puertos, rutas, etc.)
│   │   ├── gradlew / gradlew.bat
│   │   └── settings.gradle
│   │
│   ├── build/
│   ├── bin/
│   ├── .gradle/
│   └── build.gradle
│
├── proxy-http/                            # Proxy HTTP (Node.js + Express)
│   ├── src/
│   │   ├── config/
│   │   │   └── constants.js               # Constantes y configuración general
│   │   ├── middleware/
│   │   │   └── validation.js              # Middleware de validación
│   │   ├── routes/
│   │   │   └── index.js                   # Definición de rutas HTTP
│   │   ├── services/
│   │   │   ├── commandService.js          # Comunicación con el servidor TCP
│   │   │   └── socketManager.js           # Gestión de sockets TCP
│   │   └── index.js                       ⭐ Entrada principal del proxy
│   ├── package.json
│   ├── package-lock.json
│   └── start-all.js
│
├── cliente-web/                           # Cliente Web (HTML/JS/CSS)
│   ├── js/
│   │   ├── auth.js                        # Manejo de autenticación
│   │   ├── chats.js                       # Manejo de chats
│   │   ├── config.js                      # Configuración del cliente
│   │   ├── groups.js                      # Gestión de grupos
│   │   ├── main.js                        ⭐ Punto de entrada
│   │   ├── messages.js                    # Envío/recepción de mensajes
│   │   ├── notifications.js               # Notificaciones visuales
│   │   ├── polling.js                     # Sincronización periódica
│   │   ├── state.js                       # Estado global del cliente
│   │   └── ui.js                          # Manipulación de la interfaz
│   ├── groups.json
│   ├── index.html
│   └── style.css
│
├── start-all.js                           ⭐ Script global de inicio
├── package.json                           # Configuración raíz
└── README.md                              # Documentación general


```
---
<p align="center">
  <img src="https://github.com/user-attachments/assets/313fec48-dd0b-47f6-9685-0b92bca38529" alt="Estructura del proyecto COMPU_NET" width="800"/>
</p>
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

-----



## 🎓 Conclusión

Este proyecto demuestra la transición exitosa de una arquitectura **Cliente-Servidor TCP pura** hacia un **sistema web moderno con proxy HTTP**.

### Conceptos Aprendidos

✅ Comunicación TCP/IP con sockets  
✅ Arquitectura de microservicios (Cliente → Proxy → Servidor)  
✅ Traducción de protocolos (HTTP ↔ TCP)  
✅ Persistencia de datos con JSON  
✅ Concurrencia y manejo de múltiples conexiones  
✅ Desarrollo full-stack (Java + Node.js + JavaScript)  

---
 

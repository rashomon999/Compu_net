# Proyecto: Chat TCP con Mensajes de Voz y Texto

### Autores:
**Luis**, **Wilder**, **Valentina**

---

### Lenguaje y Tecnologías
- **Lenguaje:** Java ☕  
- **Tecnologías:** TCP Sockets, GSON, Java Sound API 🎧  

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

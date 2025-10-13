Proyecto: Chat TCP con Mensajes de Voz y Texto

**Autores:** Luis, Wilder y Valentina  
**Lenguaje:** Java  
**Tecnologías:** TCP Sockets, GSON, Java Sound API  

Descripción General
Este proyecto implementa un sistema de chat en red con soporte para:

✅ Comunicación entre múltiples clientes

✅ Envío y recepción de mensajes de texto

✅ Envío y reproducción de notas de voz

✅ Historial de chat persistente en JSON

✅ Grupos de chat con gestión de miembros

✅ Gestión de archivos de audio (guardar, listar, eliminar)

El sistema utiliza Sockets TCP para la comunicación y Object Streams (ObjectInputStream / ObjectOutputStream) para transmitir objetos serializados como String o VoiceMessage.

Arquitectura del Proyecto
La aplicación se divide en dos componentes principales:

Servidor (Server.java)
Escucha conexiones entrantes por el puerto 9090.

Mantiene un registro de clientes conectados.

Redirige los mensajes (de texto o voz) al destinatario o grupo correspondiente.

Guarda el historial de mensajes y los audios asociados mediante HistoryManager y AudioFileManager.

Cliente (Client.java)
Permite conectarse al servidor con un nombre de usuario.

Envía y recibe mensajes.

Puede grabar notas de voz con AudioCapturer y reproducirlas con AudioPlayer.

Soporta mensajes individuales o grupales.

Estructura del Código
src/main/java ├── tcp/ │ ├── ClientHandler.java
│ ├── Server.java
│ ├── udp/ │ └── UDPVoiceServer.java
│ ├── utils/ │ ├── AudioCapturer.java
│ ├── AudioFileManager.java
│ ├── AudioPlayer.java
│ ├── HistoryManager.java
│ ├── MessageProtocol.java
│ ├── VoiceMessage.java
│ └── Config.java
│ └── audio_files/ # Carpeta donde se guardan los audios

Funcionamiento del Sistema
Inicio del Servidor $ java tcp.Server
El servidor crea el ServerSocket en el puerto 9090 y muestra:

SERVIDOR DE CHAT INICIADO Puerto TCP: 9090 Esperando conexiones...

Conexión del Cliente
Cada cliente se conecta ingresando su nombre de usuario y la IP del servidor. El servidor guarda su conexión y empieza a escuchar los mensajes que envía.

Envío de Mensajes de Texto
Los mensajes normales se envían como cadenas (String) y se registran en el historial (chat_history.json).

Ejemplo en consola:

[PRIVADO] [2025-10-13 11:24:01] Luis → Valentina: ¡Hola! ¿Cómo estás?

Envío de Mensajes de Voz
Los mensajes de voz se capturan con el micrófono usando AudioCapturer y se envían como objetos VoiceMessage.

El servidor:

Guarda el archivo .wav en audio_files/

Crea una entrada en el historial con referencia [AUDIO_FILE:nombre.wav]

Reenvía el audio al destinatario o grupo

Reproducción de Audio
El cliente que recibe una nota de voz usa AudioPlayer para reproducirla:

Reproduciendo nota de voz de Luis (4.5 segundos)

Grupos
Los grupos se crean y administran desde HistoryManager.

Los miembros se guardan en groups.json.

Los mensajes de grupo se etiquetan así:

[GRUPO: Amigos] [2025-10-13 11:27:45] Luis → Todos: [NOTA DE VOZ] (Luis_to_Amigos_20251013_112745.wav)

Archivos JSON generados
Archivo y Descripción chat_history.json - Contiene todos los mensajes enviados y recibidos groups.json - Lista de grupos creados con sus miembros audio_files/ - Carpeta donde se almacenan las notas de voz (.wav)

Clases más importantes
Clase y Rol principal

Server - Acepta conexiones y redirige mensajes

ClientHandler - Controla la comunicación con un cliente

VoiceMessage - Representa un mensaje de voz serializable

AudioCapturer - Graba audio desde el micrófono

AudioPlayer - Reproduce archivos de audio

HistoryManager - Registra, guarda y elimina mensajes

AudioFileManager - Administra los archivos de audio (.wav)

Config - Guarda la configuración de red (host y puerto)

Ejecución Rápida
Compilar todo el proyecto:

javac -d bin src/**/*.java
Iniciar el servidor:

java -cp bin tcp.Server
Iniciar varios clientes:

java -cp bin tcp.Client
Enviar mensajes o grabar notas de voz.

Eliminar Historial
Para borrar todo el historial de un usuario (mensajes + audios):

history.deleteUserHistory("Luis");
Esto eliminará tanto los mensajes del JSON como los archivos de audio asociados.

Conclusión
Este proyecto demuestra el uso combinado de:

Sockets TCP para comunicación entre procesos

Serialización de objetos Java

Persistencia en JSON (GSON)

Procesamiento de audio con Java Sound API

Es una implementación sólida de un chat multimedia distribuido, aplicando conceptos de concurrencia, persistencia y comunicación en red.

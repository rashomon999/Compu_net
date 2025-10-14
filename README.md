# Proyecto: Chat TCP con Mensajes de Voz y Texto

### Autores:
**Luis**, **Wilder**, **Valentina**

---

## Descripción General

Este proyecto implementa un **chat por red local** usando **Java y TCP Sockets**, que permite:

- Enviar mensajes de texto entre usuarios.
  
- Grabar y enviar notas de voz.
    
- Crear y usar grupos de chat.
  
- Mantener un historial de mensajes (texto y audio) en archivos JSON.  

Todo el sistema funciona sobre una arquitectura **Cliente-Servidor**, donde el servidor gestiona las conexiones y los clientes se comunican entre sí enviando objetos serializados.

---

## Cómo Funciona el Proyecto

1. **Se inicia el servidor** (`Server.java`):  
   Este abre un puerto TCP (por defecto **9090**) y queda esperando conexiones.

   ```bash
   java tcp.Server
   
Ejemplo de salida:

SERVIDOR DE CHAT INICIADO
Puerto TCP: 9090
Esperando conexiones...

2. Los clientes se conectan al servidor (Client.java):
   
   Al iniciar, el cliente pide el nombre de usuario y la IP (IPv4) del servidor.
   
   Si la conexión es exitosa, ya puede enviar o recibir mensajes.


java tcp.Client

3. Comunicación entre usuarios:

- Los mensajes de texto se envían y se guardan en chat_history.json.

- Las notas de voz se graban con el micrófono, se envían como archivos .wav y también se guardan.

- El cliente puede reproducir las notas recibidas directamente desde la aplicación.

4. Grupos de chat:

   Los usuarios pueden crear grupos y enviar mensajes de texto o audio a todos los miembros.

   Los grupos y sus miembros se guardan en groups.json.

Archivos Generados

Archivo	y Descripción

chat_history.json
Registro completo de mensajes enviados y recibidos.

groups.json
Lista de grupos creados y sus miembros.

audio_files/ 
Carpeta donde se almacenan las notas de voz (.wav).

## Ejemplo de Uso

# En una terminal
java tcp.Server

# En otra terminal (en el mismo equipo o red)
java tcp.Client

Luego, ingresa tu nombre de usuario y la IP del servidor (ejemplo: 192.168.1.10).
Podrás:

- Enviar mensajes privados o a grupos.

- Grabar y escuchar notas de voz.

- Ver el historial de tus conversaciones.

# Componentes Principales

Clase y	Descripción

Server	
Gestiona las conexiones y reenvía mensajes entre clientes.

Client
Permite enviar y recibir mensajes o audios.

VoiceMessage	
Representa un mensaje de voz.

AudioCapturer / AudioPlayer	
Captura y reproduce audio.

HistoryManager	
Guarda los mensajes y audios en JSON.

#Conclusión

Este proyecto demuestra el uso de:

- Sockets TCP para comunicación en red.

- Serialización de objetos Java para envío de datos complejos.

- Persistencia en JSON (usando GSON).

- Procesamiento de audio con la API Java Sound.

Es una aplicación funcional que combina red, concurrencia y multimedia para crear un chat distribuido simple y completo.

# Cómo Ejecutar Rápido

javac -d bin src/**/*.java
java -cp bin tcp.Server
java -cp bin tcp.Client

# Nota Final
Solo necesitas iniciar el servidor, conectarte desde los clientes usando la IP del servidor y ¡ya puedes chatear o enviar notas de voz!

- Persistencia con JSON (GSON)

- Procesamiento de audio con Java Sound API

- Es una implementación sólida de un chat multimedia distribuido, aplicando concurrencia, persistencia y comunicación en red.

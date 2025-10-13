package tcp;

import utils.HistoryManager;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/**
 * Representa el servidor principal del sistema de chat TCP.
 *
 * Se encarga de escuchar conexiones entrantes en un puerto fijo (9090 por defecto),
 * aceptar nuevos clientes, y crear un hilo independiente ({@link ClientHandler})
 * para manejar cada conexión.
 *
 * Responsabilidades principales:
 * 
 *     Inicializar el servidor y escuchar en el puerto definido.
 *     Aceptar múltiples conexiones de clientes concurrentemente.
 *     Crear y registrar manejadores de cliente (threads).
 *     Compartir la instancia global de {@link HistoryManager} para persistencia de mensajes.
 *
 * Ejemplo de ejecución:
 *     java tcp.Server
 *
 * El servidor mostrará un banner de inicio y quedará a la espera de clientes.
 */

public class Server {
    //Puerto TCP por defecto donde escuchará el servidor.
    private static final int PORT = 9090;

    /**
     * Estructura concurrente que almacena los clientes conectados.
     * La clave es el nombre de usuario, y el valor es el {@link ObjectOutputStream}
     * asociado a cada socket para poder enviar objetos (mensajes, audios, etc.).
     */
    private static Map<String, ObjectOutputStream> clients = new ConcurrentHashMap<>();

    //Manejador global del historial de mensajes y grupos.
    private static HistoryManager history;

    /**
     * Punto de entrada principal del servidor de chat.
     * @param args argumentos de línea de comandos (no utilizados).
     * @throws IOException si ocurre un error al iniciar el servidor o aceptar conexiones.
     */
    public static void main(String[] args) throws IOException {
        System.out.println("╔════════════════════════════════╗");
        System.out.println("║   SERVIDOR DE CHAT INICIADO   ║");
        System.out.println("╚════════════════════════════════╝");
        System.out.println("Puerto TCP: " + PORT);
        System.out.println("Esperando conexiones...\n");

        // Inicializa el gestor de historial (mensajes y grupos)
        history = new HistoryManager();

        // Crea el socket del servidor
        ServerSocket serverSocket = new ServerSocket(PORT);
    
        // Bucle infinito para aceptar múltiples clientes
        while (true) {
            Socket clientSocket = serverSocket.accept();
            // Crea un manejador independiente para cada cliente
            new Thread(new ClientHandler(clientSocket, clients, history)).start();
        }
    }
}
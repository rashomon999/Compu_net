package tcp;
//project\backend-java\server\src\main\java\tcp\Server.java
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import utils.HistoryManager;

/**
 * Servidor TCP con Pool de Hilos (Escalable)
 */
public class Server {
    private static final int PORT = 9090;
    private static final int MAX_THREADS = 50; // Pool limitado
    
    private static Map<String, PrintWriter> clients = new ConcurrentHashMap<>();
    private static HistoryManager history;
    private static ExecutorService threadPool;

    public static void main(String[] args) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║   SERVIDOR TCP CON POOL DE HILOS     ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("Puerto TCP: " + PORT);
        System.out.println("Threads máximos: " + MAX_THREADS);
        System.out.println("Esperando conexiones...\n");

        // Inicializar servicios
        history = new HistoryManager();
        threadPool = Executors.newFixedThreadPool(MAX_THREADS);
        
        // Agregar shutdown hook para cerrar recursos al salir
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\n[!] Cerrando servidor...");
            threadPool.shutdown();
            try {
                if (!threadPool.awaitTermination(5, TimeUnit.SECONDS)) {
                    threadPool.shutdownNow();
                }
            } catch (InterruptedException e) {
                threadPool.shutdownNow();
            }
            System.out.println("[✓] Servidor cerrado correctamente");
        }));

        // Bucle principal de aceptación de conexiones
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            System.out.println("[✓] Servidor iniciado correctamente\n");
            
            while (!threadPool.isShutdown()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    System.out.println("[+] Nueva conexión desde " + 
                                     clientSocket.getInetAddress());
                    
                    // Delegar al pool de hilos (NO crear hilo nuevo)
                    threadPool.execute(
                        new TextClientHandler(clientSocket, clients, history)
                    );
                    
                    System.out.println("[INFO] Hilos activos: " + 
                                     ((ThreadPoolExecutor) threadPool).getActiveCount() + 
                                     "/" + MAX_THREADS);
                    
                } catch (IOException e) {
                    if (!threadPool.isShutdown()) {
                        System.err.println("[ERROR] Error aceptando conexión: " + 
                                         e.getMessage());
                    }
                }
            }
            
        } catch (IOException e) {
            System.err.println("[FATAL] Error iniciando servidor: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
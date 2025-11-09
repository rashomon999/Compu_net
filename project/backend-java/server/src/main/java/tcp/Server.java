package tcp;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import utils.HistoryManager;
import websocket.CompunetWebSocketServer;

/**
 * Servidor TCP con Pool de Hilos + WebSocket
 */
public class Server {
    private static final int PORT = 9090;
    private static final int MAX_THREADS = 50;
    
    private static Map<String, PrintWriter> clients = new ConcurrentHashMap<>();
    private static HistoryManager history;
    private static ExecutorService threadPool;
    private static CompunetWebSocketServer wsServer;

    public static void main(String[] args) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║   SERVIDOR TCP + WEBSOCKET (DUAL)    ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("Puerto TCP: " + PORT);
        System.out.println("Puerto WebSocket: 8080");
        System.out.println("Threads máximos: " + MAX_THREADS);
        System.out.println("Esperando conexiones...\n");

        // Inicializar servicios
        history = new HistoryManager();
        threadPool = Executors.newFixedThreadPool(MAX_THREADS);
        
        wsServer = new CompunetWebSocketServer(history);
        
        // Agregar shutdown hook
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\n[!] Cerrando servidores...");
            threadPool.shutdown();
            try {
                wsServer.stop();
                if (!threadPool.awaitTermination(5, TimeUnit.SECONDS)) {
                    threadPool.shutdownNow();
                }
            } catch (Exception e) {
                threadPool.shutdownNow();
            }
            System.out.println("[✓] Servidores cerrados correctamente");
        }));

        // Iniciar WebSocket en hilo separado
        new Thread(() -> {
            try {
                wsServer.start();
            } catch (Exception e) {
                System.err.println("[ERROR] Error iniciando WebSocket: " + e.getMessage());
            }
        }).start();

        // Bucle principal TCP (existente)
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            System.out.println("[✓] Servidor TCP iniciado correctamente\n");
            
            while (!threadPool.isShutdown()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    System.out.println("[+] Nueva conexión TCP desde " + 
                                     clientSocket.getInetAddress());
                    
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
            System.err.println("[FATAL] Error iniciando servidor TCP: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}

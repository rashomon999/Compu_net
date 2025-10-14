package tcp;

import utils.HistoryManager;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class Server {
    private static final int PORT = 9090;

    // Cambiamos PrintWriter por ObjectOutputStream
    private static Map<String, ObjectOutputStream> clients = new ConcurrentHashMap<>();
    private static HistoryManager history;

    public static void main(String[] args) throws IOException {
        System.out.println("╔════════════════════════════════╗");
        System.out.println("║   SERVIDOR DE CHAT INICIADO   ║");
        System.out.println("╚════════════════════════════════╝");
        System.out.println("Puerto TCP: " + PORT);
        System.out.println("Esperando conexiones...\n");

        history = new HistoryManager();

        ServerSocket serverSocket = new ServerSocket(PORT);

        while (true) {
            Socket clientSocket = serverSocket.accept();
            // Iniciamos un ClientHandler con ObjectOutputStream map
            new Thread(new ClientHandler(clientSocket, clients, history)).start();
        }
    }
}

package tcp;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import utils.HistoryManager;

public class Server {
    private static final int PORT = 9090;
    
    // Cambiado de ObjectOutputStream a PrintWriter
    private static Map<String, PrintWriter> clients = new ConcurrentHashMap<>();
    private static HistoryManager history;

    public static void main(String[] args) throws IOException {
        System.out.println("╔════════════════════════════════╗");
        System.out.println("║ SERVIDOR TCP PARA WEB CLIENT  ║");
        System.out.println("╚════════════════════════════════╝");
        System.out.println("Puerto TCP: " + PORT);
        System.out.println("Esperando conexiones...\n");

        history = new HistoryManager();
        ServerSocket serverSocket = new ServerSocket(PORT);

        while (true) {
            Socket clientSocket = serverSocket.accept();
            System.out.println("[+] Nueva conexión desde " + clientSocket.getInetAddress());
            new Thread(new TextClientHandler(clientSocket, clients, history)).start();
        }
    }
}
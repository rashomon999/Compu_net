package ice;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Util;
import utils.HistoryManager;

public class IceServer {
    private static final int ICE_PORT = 9099;
    private static final String ICE_HOST = "localhost";
    
    public static void main(String[] args) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║   SERVIDOR ICE RPC CON WEBSOCKETS     ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("Puerto Ice WebSocket: " + ICE_PORT);
        System.out.println("Host: " + ICE_HOST);
        System.out.println("Iniciando servidor...\n");
        
        Communicator communicator = null;
        
        try {
            // Initialize Ice communicator
            communicator = Util.initialize(args);
            
            // Create object adapter with WebSocket endpoint
            String endpoint = String.format("ws -h %s -p %d", ICE_HOST, ICE_PORT);
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints("ChatAdapter", endpoint);
            
            // Initialize services
            HistoryManager historyManager = new HistoryManager();
            ChatServiceImpl chatService = new ChatServiceImpl(historyManager);
            
            // Add servant to adapter
            adapter.add(chatService, Util.stringToIdentity("ChatService"));
            
            // Activate adapter
            adapter.activate();
            
            System.out.println("[✓] Servidor Ice iniciado correctamente");
            System.out.println("[✓] Endpoint: " + endpoint);
            System.out.println("[✓] Esperando conexiones...\n");
            
            // Wait for shutdown
            communicator.waitForShutdown();
            
        } catch (Exception e) {
            System.err.println("[FATAL] Error iniciando servidor Ice: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        } finally {
            if (communicator != null) {
                try {
                    communicator.destroy();
                    System.out.println("\n[✓] Servidor Ice cerrado correctamente");
                } catch (Exception e) {
                    System.err.println("[ERROR] Error cerrando Ice: " + e.getMessage());
                }
            }
        }
    }
}

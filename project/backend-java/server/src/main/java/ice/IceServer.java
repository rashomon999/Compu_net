package ice;
// Ubicación: backend-java/server/src/main/java/ice/IceServer.java

import com.zeroc.Ice.*;
import ice.services.*;
import tcp.*;
import utils.HistoryManager;

import java.io.PrintWriter;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servidor ICE principal que expone todos los servicios del chat
 * Utiliza WebSocket para comunicación con clientes JavaScript
 */
public class IceServer {
    
    public static void main(String[] args) {
        System.out.println("╔════════════════════════════════════════════╗");
        System.out.println("║    SERVIDOR ICE - SISTEMA DE CHAT         ║");
        System.out.println("╚════════════════════════════════════════════╝");
        System.out.println();
        
        int returnValue = 0;
        
        try (Communicator communicator = Util.initialize(args)) {
            
            // ============================================================
            // 1. INICIALIZAR COMPONENTES COMPARTIDOS
            // ============================================================
            System.out.println("[1/4] Inicializando componentes...");
            
            HistoryManager historyManager = new HistoryManager();
            ConcurrentHashMap<String, PrintWriter> clients = new ConcurrentHashMap<>();
            
            // Servicios de lógica de negocio (reutilizados)
            tcp.MessageService messageService = new tcp.MessageService(historyManager, clients);
            tcp.GroupService groupService = new tcp.GroupService(historyManager);
            tcp.HistoryService historyService = new tcp.HistoryService(historyManager);
            tcp.UserService userService = new tcp.UserService(clients);
            
            System.out.println("   ✓ HistoryManager inicializado");
            System.out.println("   ✓ Servicios de negocio listos");
            
            // ============================================================
            // 2. CONFIGURAR ADAPTADOR DE OBJETOS ICE
            // ============================================================
            System.out.println("\n[2/4] Configurando adaptador ICE...");
            
            // Crear adaptador con WebSocket en puerto 10000
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                "ChatAdapter",
                "ws -h 0.0.0.0 -p 10000"  // WebSocket accesible desde navegador
            );
            
            System.out.println("   ✓ Adaptador configurado en puerto 10000 (WebSocket)");
            
            // ============================================================
            // 3. REGISTRAR SERVICIOS ICE
            // ============================================================
            System.out.println("\n[3/4] Registrando servicios ICE...");
            
            // Servicio de Chat (mensajería)
            ChatServiceI chatServiceImpl = new ChatServiceI(messageService, historyService);
            adapter.add(chatServiceImpl, Util.stringToIdentity("ChatService"));
            System.out.println("   ✓ ChatService registrado");
            
            // Servicio de Grupos
            GroupServiceI groupServiceImpl = new GroupServiceI(groupService, historyManager);
            adapter.add(groupServiceImpl, Util.stringToIdentity("GroupService"));
            System.out.println("   ✓ GroupService registrado");
            
            // Servicio de Notificaciones (Observer)
            NotificationServiceI notificationServiceImpl = new NotificationServiceI(historyService);
            adapter.add(notificationServiceImpl, Util.stringToIdentity("NotificationService"));
            System.out.println("   ✓ NotificationService registrado");
            
            // Conectar MessageService con NotificationService para push
            chatServiceImpl.setNotificationService(notificationServiceImpl);
            
            // Servicio de Voz
            VoiceServiceI voiceServiceImpl = new VoiceServiceI(historyManager, notificationServiceImpl);
            adapter.add(voiceServiceImpl, Util.stringToIdentity("VoiceService"));
            System.out.println("   ✓ VoiceService registrado");
            
            // ⚡ NUEVO: Servicio de Llamadas
            CallServiceI callServiceImpl = new CallServiceI();
            adapter.add(callServiceImpl, Util.stringToIdentity("CallService"));
            System.out.println("   ✓ CallService registrado");
            
            // ============================================================
            // 4. ACTIVAR SERVIDOR
            // ============================================================
            System.out.println("\n[4/4] Activando servidor...");
            
            adapter.activate();
            
            System.out.println("\n╔════════════════════════════════════════════╗");
            System.out.println("║  ✓ SERVIDOR ICE LISTO                     ║");
            System.out.println("╚════════════════════════════════════════════╝");
            System.out.println();
            System.out.println("📡 WebSocket: ws://localhost:10000");
            System.out.println("📋 Servicios disponibles:");
            System.out.println("   • ChatService");
            System.out.println("   • GroupService");
            System.out.println("   • NotificationService");
            System.out.println("   • VoiceService");
            System.out.println("   • CallService 📞");
            System.out.println();
            System.out.println("🌐 Cliente web: http://localhost:3000");
            System.out.println();
            System.out.println("⚠️  Presiona Ctrl+C para detener el servidor");
            System.out.println();
            
            // Mantener el servidor en ejecución
            communicator.waitForShutdown();
            
        }  
        System.out.println("\n👋 Servidor ICE detenido");
        System.exit(returnValue);
    }
    
}
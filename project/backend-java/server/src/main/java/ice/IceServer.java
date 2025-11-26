package ice;

import com.zeroc.Ice.*;
import ice.services.*;
import tcp.*;
import utils.HistoryManager;

import java.io.PrintWriter;
import java.util.concurrent.ConcurrentHashMap;

public class IceServer {
    
    public static void main(String[] args) {
        System.out.println("╔════════════════════════════════════════════╗");
        System.out.println("║    SERVIDOR ICE - SISTEMA DE CHAT         ║");
        System.out.println("╚════════════════════════════════════════════╝");
        System.out.println();
        
        int returnValue = 0;
        
        try (Communicator communicator = Util.initialize(args)) {
            
            System.out.println("[1/4] Inicializando componentes...");
            
            HistoryManager historyManager = new HistoryManager();
            ConcurrentHashMap<String, PrintWriter> clients = new ConcurrentHashMap<>();
            
            tcp.MessageService messageService = new tcp.MessageService(historyManager, clients);
            tcp.GroupService groupService = new tcp.GroupService(historyManager);
            tcp.HistoryService historyService = new tcp.HistoryService(historyManager);
            tcp.UserService userService = new tcp.UserService(clients);
            
            System.out.println("   ✓ HistoryManager inicializado");
            System.out.println("   ✓ Servicios de negocio listos");
            
            System.out.println("\n[2/4] Configurando adaptador ICE...");
            
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                "ChatAdapter",
                "ws -h 0.0.0.0 -p 10000"
            );
            
            System.out.println("   ✓ Adaptador configurado en puerto 10000 (WebSocket)");
            
            System.out.println("\n[3/4] Registrando servicios ICE...");
            
            ChatServiceI chatServiceImpl = new ChatServiceI(messageService, historyService);
            adapter.add(chatServiceImpl, Util.stringToIdentity("ChatService"));
            System.out.println("   ✓ ChatService registrado");
            
            GroupServiceI groupServiceImpl = new GroupServiceI(groupService, historyManager);
            adapter.add(groupServiceImpl, Util.stringToIdentity("GroupService"));
            System.out.println("   ✓ GroupService registrado");
            
            NotificationServiceI notificationServiceImpl = new NotificationServiceI(historyService);
            adapter.add(notificationServiceImpl, Util.stringToIdentity("NotificationService"));
            System.out.println("   ✓ NotificationService registrado");
            
            chatServiceImpl.setNotificationService(notificationServiceImpl);
            
            VoiceServiceI voiceServiceImpl = new VoiceServiceI(historyManager, notificationServiceImpl);
            adapter.add(voiceServiceImpl, Util.stringToIdentity("VoiceService"));
            System.out.println("   ✓ VoiceService registrado");
            
            CallServiceI callServiceImpl = new CallServiceI();
            adapter.add(callServiceImpl, Util.stringToIdentity("CallService"));
            System.out.println("   ✓ CallService registrado");
            
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
            
            communicator.waitForShutdown();
            
        }  
        System.out.println("\n👋 Servidor ICE detenido");
        System.exit(returnValue);
    }
}
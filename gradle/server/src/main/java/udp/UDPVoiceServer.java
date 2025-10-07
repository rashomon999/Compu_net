package udp;

import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class UDPVoiceServer {
    private static final int UDP_PORT = 9091;
    private static Map<String, InetSocketAddress> activeCallers = new ConcurrentHashMap<>();
    private static Map<String, String> callSessions = new ConcurrentHashMap<>(); // caller -> receiver

    public static void main(String[] args) throws Exception {
        System.out.println("╔════════════════════════════════╗");
        System.out.println("║   SERVIDOR UDP VOZ INICIADO   ║");
        System.out.println("╚════════════════════════════════╝");
        System.out.println("Puerto UDP: " + UDP_PORT);
        System.out.println("Esperando paquetes de voz...\n");
        
        DatagramSocket socket = new DatagramSocket(UDP_PORT);
        byte[] buffer = new byte[4096];

        while (true) {
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
            socket.receive(packet);

            // Procesar paquete en thread separado
            new Thread(() -> handlePacket(socket, packet)).start();
        }
    }

    private static void handlePacket(DatagramSocket socket, DatagramPacket packet) {
        try {
            String message = new String(packet.getData(), 0, packet.getLength());
            String[] parts = message.split(":", 3);

            if (parts.length < 2) return;

            String command = parts[0];
            String username = parts[1];

            switch (command) {
                case "REGISTER":
                    // REGISTER:username
                    InetSocketAddress address = new InetSocketAddress(
                        packet.getAddress(), packet.getPort()
                    );
                    activeCallers.put(username, address);
                    System.out.println("[UDP] ✅ " + username + " registrado para llamadas");
                    break;

                case "CALL":
                    // CALL:caller:receiver
                    if (parts.length >= 3) {
                        String receiver = parts[2];
                        callSessions.put(username, receiver);
                        
                        InetSocketAddress receiverAddr = activeCallers.get(receiver);
                        if (receiverAddr != null) {
                            String notification = "INCOMING_CALL:" + username;
                            byte[] data = notification.getBytes();
                            DatagramPacket response = new DatagramPacket(
                                data, data.length, receiverAddr
                            );
                            socket.send(response);
                            System.out.println("[UDP] 📞 Llamada de " + username + " a " + receiver);
                        }
                    }
                    break;

                case "AUDIO":
                    // AUDIO:sender:audioData
                    String receiver = callSessions.get(username);
                    if (receiver != null) {
                        InetSocketAddress receiverAddr = activeCallers.get(receiver);
                        if (receiverAddr != null) {
                            // Reenviar audio al receptor
                            socket.send(new DatagramPacket(
                                packet.getData(), packet.getLength(), receiverAddr
                            ));
                        }
                    }
                    break;

                case "END_CALL":
                    callSessions.remove(username);
                    System.out.println("[UDP] 🔴 " + username + " finalizó llamada");
                    break;
            }

        } catch (Exception e) {
            System.err.println("Error procesando paquete UDP: " + e.getMessage());
        }
    }
}
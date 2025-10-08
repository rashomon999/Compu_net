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
            String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 100));
            
            if (header.startsWith("REGISTER:")) {
                String username = header.split(":")[1];
                InetSocketAddress address = new InetSocketAddress(packet.getAddress(), packet.getPort());
                activeCallers.put(username, address);
                System.out.println("[UDP]  " + username + " registrado para llamadas");
            } else if (header.startsWith("CALL:")) {
                String[] parts = header.split(":");
                String caller = parts[1];
                String receiver = parts[2];
                callSessions.put(caller, receiver);

                InetSocketAddress receiverAddr = activeCallers.get(receiver);
                if (receiverAddr != null) {
                    String notification = "INCOMING_CALL:" + caller;
                    byte[] data = notification.getBytes();
                    DatagramPacket response = new DatagramPacket(data, data.length, receiverAddr);
                    socket.send(response);
                    System.out.println("[UDP]  Llamada de " + caller + " a " + receiver);
                }
            } else if (header.startsWith("AUDIO:")) {
                String[] parts = header.split(":", 3);
                String sender = parts[1];
                String receiver = callSessions.get(sender);
                if (receiver != null) {
                    InetSocketAddress receiverAddr = activeCallers.get(receiver);
                    if (receiverAddr != null) {
                        // Enviar el paquete original (bytes puros) al receptor
                        DatagramPacket forward = new DatagramPacket(
                                packet.getData(), packet.getLength(), receiverAddr
                        );
                        socket.send(forward);
                    }
                }
            } else if (header.startsWith("END_CALL:")) {
                String user = header.split(":")[1];
                callSessions.remove(user);
                System.out.println("[UDP] " + user + " finalizó llamada");
            }
        } catch (Exception e) {
            System.err.println("Error procesando paquete UDP: " + e.getMessage());
        }
    }
}

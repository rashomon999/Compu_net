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
        byte[] buffer = new byte[512];

        while (true) {
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
            socket.receive(packet);
            new Thread(() -> handlePacket(socket, packet)).start();
        }
    }

    private static void handlePacket(DatagramSocket socket, DatagramPacket packet) {
        try {
            String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 100)).trim();

            if (header.startsWith("REGISTER:")) {
                String username = header.split(":")[1];
                InetSocketAddress address = new InetSocketAddress(packet.getAddress(), packet.getPort());
                activeCallers.put(username, address);
                System.out.println("[UDP] " + username + " registrado para llamadas");

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
                    System.out.println("[UDP] Llamada de " + caller + " a " + receiver);
                }

            } else if (header.startsWith("END_CALL:")) {
                String user = header.split(":")[1];
                callSessions.remove(user);
                System.out.println("[UDP] " + user + " finalizó llamada");

            } else {
                // 🔊 Paquete de audio puro (sin encabezado)
                String sender = findSender(packet.getAddress(), packet.getPort());
                if (sender != null) {
                    String receiver = callSessions.get(sender);
                    if (receiver != null) {
                        InetSocketAddress receiverAddr = activeCallers.get(receiver);
                        if (receiverAddr != null) {
                            DatagramPacket forward = new DatagramPacket(
                                    packet.getData(), packet.getLength(),
                                    receiverAddr.getAddress(), receiverAddr.getPort()
                            );
                            socket.send(forward);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error procesando paquete UDP: " + e.getMessage());
        }
    }

    private static String findSender(InetAddress address, int port) {
        for (Map.Entry<String, InetSocketAddress> entry : activeCallers.entrySet()) {
            InetSocketAddress value = entry.getValue();
            if (value.getAddress().equals(address) && value.getPort() == port) {
                return entry.getKey();
            }
        }
        return null;
    }
}

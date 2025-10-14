package udp;

import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class UDPVoiceServer {
    private static final int UDP_PORT = 9091;
    private static Map<String, InetSocketAddress> activeCallers = new ConcurrentHashMap<>();
    private static Map<String, String> callSessions = new ConcurrentHashMap<>(); // caller -> receiver (1-to-1)
    private static Map<String, Set<String>> groupCalls = new ConcurrentHashMap<>(); // groupName -> Set of participants

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

            } else if (header.startsWith("GROUP_CALL:")) {
                String[] parts = header.split(":");
                String caller = parts[1];
                String groupName = parts[2];
                
                // Add caller to group call
                groupCalls.computeIfAbsent(groupName, k -> ConcurrentHashMap.newKeySet()).add(caller);
                
                // Notify all other participants
                Set<String> participants = groupCalls.get(groupName);
                for (String participant : participants) {
                    if (!participant.equals(caller)) {
                        InetSocketAddress participantAddr = activeCallers.get(participant);
                        if (participantAddr != null) {
                            String notification = "GROUP_CALL_JOIN:" + caller + ":" + groupName;
                            byte[] data = notification.getBytes();
                            DatagramPacket response = new DatagramPacket(data, data.length, participantAddr);
                            socket.send(response);
                        }
                    }
                }
                
                System.out.println("[UDP] " + caller + " se unió a llamada grupal: " + groupName);

            } else if (header.startsWith("END_CALL:")) {
                String user = header.split(":")[1];
                callSessions.remove(user);
                
                groupCalls.values().forEach(participants -> participants.remove(user));
                
                System.out.println("[UDP] " + user + " finalizó llamada");

            } else if (header.startsWith("END_GROUP_CALL:")) {
                String[] parts = header.split(":");
                String user = parts[1];
                String groupName = parts[2];
                
                Set<String> participants = groupCalls.get(groupName);
                if (participants != null) {
                    participants.remove(user);
                    
                    // Notify remaining participants
                    for (String participant : participants) {
                        InetSocketAddress participantAddr = activeCallers.get(participant);
                        if (participantAddr != null) {
                            String notification = "GROUP_CALL_LEAVE:" + user + ":" + groupName;
                            byte[] data = notification.getBytes();
                            DatagramPacket response = new DatagramPacket(data, data.length, participantAddr);
                            socket.send(response);
                        }
                    }
                    
                    // Remove empty group calls
                    if (participants.isEmpty()) {
                        groupCalls.remove(groupName);
                    }
                }
                
                System.out.println("[UDP] " + user + " salió de llamada grupal: " + groupName);

            } else {
                // Audio packet (no header)
                String sender = findSender(packet.getAddress(), packet.getPort());
                if (sender != null) {
                    String groupName = findGroupCall(sender);
                    if (groupName != null) {
                        // Forward to all group members except sender
                        Set<String> participants = groupCalls.get(groupName);
                        if (participants != null) {
                            for (String participant : participants) {
                                if (!participant.equals(sender)) {
                                    InetSocketAddress participantAddr = activeCallers.get(participant);
                                    if (participantAddr != null) {
                                        DatagramPacket forward = new DatagramPacket(
                                                packet.getData(), packet.getLength(),
                                                participantAddr.getAddress(), participantAddr.getPort()
                                        );
                                        socket.send(forward);
                                    }
                                }
                            }
                        }
                    } else {
                        // 1-to-1 call
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

    private static String findGroupCall(String username) {
        for (Map.Entry<String, Set<String>> entry : groupCalls.entrySet()) {
            if (entry.getValue().contains(username)) {
                return entry.getKey();
            }
        }
        return null;
    }
}

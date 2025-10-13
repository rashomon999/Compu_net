package udp;

import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/**
 * Servidor encargado de manejar llamadas de voz mediante el protocolo UDP.
 * 
 * Administra tanto llamadas individuales (1 a 1) como grupales, y reenvía los 
 * paquetes de audio entre los clientes participantes de cada sesión.
 *
 * Responsabilidades principales:
 * 
 *     Escuchar paquetes UDP en el puerto configurado (por defecto 9091).
 *     Registrar usuarios que pueden recibir llamadas.
 *     Establecer y gestionar llamadas individuales o grupales.
 *     Reenviar los datos de audio a los destinatarios adecuados.
 *     Finalizar llamadas y limpiar recursos cuando sea necesario.
 *
 * Protocolos de comunicación:
 * Los clientes envían mensajes de control con los siguientes encabezados:
 * 
 * REGISTER:username
 * CALL:caller:receiver
 * GROUP_CALL:caller:groupName
 * END_CALL:username
 * END_GROUP_CALL:username:groupName
 * 
 *
 * Si el paquete no contiene un encabezado reconocido, se interpreta como 
 * un paquete de audio y se reenvía a los destinatarios correspondientes.
 */

public class UDPVoiceServer {
    //Puerto UDP por defecto donde escucha el servidor.
    private static final int UDP_PORT = 9091;

    /**
     * Usuarios activos actualmente registrados para llamadas.
     * Mapea el nombre de usuario a su dirección de socket.
     */
    private static Map<String, InetSocketAddress> activeCallers = new ConcurrentHashMap<>();

    /**
     * Sesiones de llamadas individuales.
     * Mapea el nombre del emisor (caller) al receptor (receiver).
     */
    private static Map<String, String> callSessions = new ConcurrentHashMap<>(); 

    /**
     * Llamadas grupales activas.
     * Cada grupo almacena un conjunto de participantes.
     */
    private static Map<String, Set<String>> groupCalls = new ConcurrentHashMap<>();

    /**
     * Método principal del servidor de voz UDP.
     * Inicializa el socket, muestra la información de inicio
     * y queda en bucle infinito escuchando nuevos paquetes.
     *
     * @param args argumentos de línea de comandos (no utilizados)
     * @throws Exception si ocurre un error al crear el socket o procesar paquetes
     */
    public static void main(String[] args) throws Exception {
        System.out.println("╔════════════════════════════════╗");
        System.out.println("║   SERVIDOR UDP VOZ INICIADO   ║");
        System.out.println("╚════════════════════════════════╝");
        System.out.println("Puerto UDP: " + UDP_PORT);
        System.out.println("Esperando paquetes de voz...\n");

        DatagramSocket socket = new DatagramSocket(UDP_PORT);
        byte[] buffer = new byte[512];

        // Escucha continua de paquetes UDP
        while (true) {
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
            socket.receive(packet);
            new Thread(() -> handlePacket(socket, packet)).start();
        }
    }

    /**
     * Procesa cada paquete recibido según su tipo (registro, llamada, audio, etc.).
     *
     * @param socket socket UDP del servidor
     * @param packet paquete recibido
     */
    private static void handlePacket(DatagramSocket socket, DatagramPacket packet) {
        try {
            String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 100)).trim();

            // Registro de usuario 
            if (header.startsWith("REGISTER:")) {
                String username = header.split(":")[1];
                InetSocketAddress address = new InetSocketAddress(packet.getAddress(), packet.getPort());
                activeCallers.put(username, address);
                System.out.println("[UDP] " + username + " registrado para llamadas");

            // Llamada individual 
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

            // Llamada grupal
            } else if (header.startsWith("GROUP_CALL:")) {
                String[] parts = header.split(":");
                String caller = parts[1];
                String groupName = parts[2];
                
                // Agregar al grupo o crear si no existe
                groupCalls.computeIfAbsent(groupName, k -> ConcurrentHashMap.newKeySet()).add(caller);
                
                // Notificar a los demás participantes
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

            // Finalizar llamada individual
            } else if (header.startsWith("END_CALL:")) {
                String user = header.split(":")[1];
                callSessions.remove(user);
                
                groupCalls.values().forEach(participants -> participants.remove(user));
                
                System.out.println("[UDP] " + user + " finalizó llamada");

            // Finalizar llamada grupal
            } else if (header.startsWith("END_GROUP_CALL:")) {
                String[] parts = header.split(":");
                String user = parts[1];
                String groupName = parts[2];
                
                Set<String> participants = groupCalls.get(groupName);
                if (participants != null) {
                    participants.remove(user);
                    
                    // Notificar a los demás
                    for (String participant : participants) {
                        InetSocketAddress participantAddr = activeCallers.get(participant);
                        if (participantAddr != null) {
                            String notification = "GROUP_CALL_LEAVE:" + user + ":" + groupName;
                            byte[] data = notification.getBytes();
                            DatagramPacket response = new DatagramPacket(data, data.length, participantAddr);
                            socket.send(response);
                        }
                    }
                    
                    // Eliminar grupo vacío
                    if (participants.isEmpty()) {
                        groupCalls.remove(groupName);
                    }
                }
                
                System.out.println("[UDP] " + user + " salió de llamada grupal: " + groupName);

            // Paquete de audio
            } else {
                String sender = findSender(packet.getAddress(), packet.getPort());
                if (sender != null) {
                    String groupName = findGroupCall(sender);
                    if (groupName != null) {
                        // Reenviar a todos los del grupo excepto al emisor
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
                        // Llamada 1 a 1
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

    /**
     * Busca el nombre de usuario asociado a una dirección IP y puerto UDP.
     *
     * @param address dirección IP del paquete
     * @param port puerto del paquete
     * @return nombre del usuario si se encuentra, de lo contrario {@code null}
     */
    private static String findSender(InetAddress address, int port) {
        for (Map.Entry<String, InetSocketAddress> entry : activeCallers.entrySet()) {
            InetSocketAddress value = entry.getValue();
            if (value.getAddress().equals(address) && value.getPort() == port) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * Busca el nombre del grupo al que pertenece un usuario.
     *
     * @param username nombre del usuario
     * @return nombre del grupo si pertenece a uno, de lo contrario {@code null}
     */
    private static String findGroupCall(String username) {
        for (Map.Entry<String, Set<String>> entry : groupCalls.entrySet()) {
            if (entry.getValue().contains(username)) {
                return entry.getKey();
            }
        }
        return null;
    }
}
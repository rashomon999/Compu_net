package udp;

import javax.sound.sampled.*;
import java.net.*;

/**
 * Cliente UDP encargado de manejar las llamadas de voz (individuales o grupales)
 * dentro del sistema de chat. Este módulo utiliza el protocolo **UDP** debido a que
 * las transmisiones de audio requieren baja latencia y pueden tolerar la pérdida
 * ocasional de paquetes.
 *
 * Funcionalidades principales:
 *
 *   Registro del usuario en el servidor de voz UDP.
 *   Inicio de llamadas individuales o grupales.
 *   Captura de audio desde el micrófono y envío mediante UDP.
 *   Recepción de audio desde otros clientes y reproducción en tiempo real.
 *   Finalización y cierre de llamadas.
 *
 * Esta clase utiliza las librerías de audio de {@link javax.sound.sampled}
 * para la captura y reproducción de sonido en tiempo real.
 */

public class UDPVoiceClient {
    //Dirección IP o nombre del servidor UDP.
    private final String serverHost;
    //Puerto UDP donde se comunica el servidor de voz.
    private static final int UDP_PORT = 9091;
    //Socket UDP para enviar y recibir paquetes de audio.
    private DatagramSocket socket;
    //Nombre de usuario del cliente actual.
    private String username;
    //Indica si el usuario está en una llamada activa.
    private boolean inCall = false;

    //Hilos independientes para enviar y recibir audio simultáneamente.
    private Thread sendThread;
    private Thread receiveThread;

    //Nombre del grupo en caso de una llamada grupal. 
    private String currentGroupCall = null;

    //Formato de audio utilizado: mono, 16 bits, 16 kHz, little-endian.
    private static final AudioFormat AUDIO_FORMAT = new AudioFormat(16000.0f, 16, 1, true, false);

    /**
     * Constructor del cliente de voz UDP.
     * Se encarga de inicializar el socket y registrar al usuario en el servidor.
     *
     * @param username nombre del usuario.
     * @param serverHost dirección o IP del servidor UDP.
     * @throws Exception si ocurre un error al registrar el cliente o abrir el socket.
     */

    public UDPVoiceClient(String username, String serverHost) throws Exception {
        this.username = username;
        this.serverHost = serverHost;
        this.socket = new DatagramSocket();

        // Enviar mensaje de registro al servidor
        String registerMsg = "REGISTER:" + username;
        byte[] data = registerMsg.getBytes();
        DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(serverHost), UDP_PORT);
        socket.send(packet);

        System.out.println("✓ Registrado en el servidor UDP de voz (" + serverHost + ")");
    }

    /**
     * Inicia una llamada individual con otro usuario.
     *
     * @param targetUser nombre del usuario destinatario.
     */

    public void startCall(String targetUser) {
        if (inCall) {
            System.out.println("✗ Ya estás en una llamada");
            return;
        }

        try {
            // Notificar inicio de llamada
            String callMsg = "CALL:" + username + ":" + targetUser;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(serverHost), UDP_PORT);
            socket.send(packet);

            inCall = true;
            System.out.println("✓ Llamada iniciada con " + targetUser);

            // Iniciar hilos de envío y recepción de audio
            sendThread = new Thread(() -> sendAudio());
            receiveThread = new Thread(() -> receiveAudio());

            sendThread.start();
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("✗ Error iniciando llamada: " + e.getMessage());
        }
    }

    /**
     * Inicia una llamada grupal con un grupo determinado.
     *
     * @param groupName nombre del grupo de chat.
     */
    public void startGroupCall(String groupName) {
        if (inCall) {
            System.out.println("✗ Ya estás en una llamada");
            return;
        }

        try {
            // Notificar inicio de llamada grupal
            String callMsg = "GROUP_CALL:" + username + ":" + groupName;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(serverHost), UDP_PORT);
            socket.send(packet);

            inCall = true;
            currentGroupCall = groupName;
            System.out.println("✓ Llamada grupal iniciada en: " + groupName);

            sendThread = new Thread(() -> sendAudio());
            receiveThread = new Thread(() -> receiveAudio());

            sendThread.start();
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("✗ Error iniciando llamada grupal: " + e.getMessage());
        }
    }

    /**
     * Captura el audio del micrófono y lo envía al servidor mediante UDP.
     */
    private void sendAudio() {
        try {
            DataLine.Info micInfo = new DataLine.Info(TargetDataLine.class, AUDIO_FORMAT);
            TargetDataLine mic = (TargetDataLine) AudioSystem.getLine(micInfo);
            mic.open(AUDIO_FORMAT);
            mic.start();

            byte[] buffer = new byte[1024];
            InetAddress serverAddr = InetAddress.getByName(serverHost);

            // Bucle de envío continuo mientras la llamada esté activa
            while (inCall) {
                int bytesRead = mic.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    DatagramPacket packet = new DatagramPacket(buffer, bytesRead, serverAddr, UDP_PORT);
                    socket.send(packet);
                }
            }

            mic.stop();
            mic.close();

        } catch (Exception e) {
            if (inCall)
                System.err.println("✗ Error enviando audio: " + e.getMessage());
        }
    }

    /**
     * Recibe paquetes UDP de audio desde el servidor y los reproduce.
     * También gestiona mensajes de control (inicio/fin de llamadas).
     */
    private void receiveAudio() {
        try {
            DataLine.Info speakerInfo = new DataLine.Info(SourceDataLine.class, AUDIO_FORMAT);
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(speakerInfo);
            speaker.open(AUDIO_FORMAT);
            speaker.start();

            byte[] buffer = new byte[2048];

            // Bucle de recepción continua
            while (inCall) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);

                // Si es un mensaje de control (no audio), lo mostramos
                String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 30)).trim();
                if (header.startsWith("CALL") || header.startsWith("END") || 
                    header.startsWith("REGISTER") || header.startsWith("GROUP")) {
                    if (header.startsWith("GROUP_CALL_JOIN:")) {
                        String[] parts = header.split(":");
                        System.out.println("\n[Llamada] " + parts[1] + " se unió a la llamada grupal");
                    } else if (header.startsWith("GROUP_CALL_LEAVE:")) {
                        String[] parts = header.split(":");
                        System.out.println("\n[Llamada] " + parts[1] + " salió de la llamada grupal");
                    }
                    continue;
                }

                // Si no es control, es audio
                speaker.write(packet.getData(), 0, packet.getLength());
            }

            speaker.drain();
            speaker.close();

        } catch (Exception e) {
            if (inCall)
                System.err.println("✗ Error recibiendo audio: " + e.getMessage());
        }
    }

    /**
     * Finaliza la llamada actual (individual o grupal)
     * y notifica al servidor UDP.
     */
    public void endCall() {
        if (!inCall)
            return;

        inCall = false;

        try {
            if (currentGroupCall != null) {
                String endMsg = "END_GROUP_CALL:" + username + ":" + currentGroupCall;
                byte[] data = endMsg.getBytes();
                DatagramPacket packet = new DatagramPacket(data, data.length,
                        InetAddress.getByName(serverHost), UDP_PORT);
                socket.send(packet);
                currentGroupCall = null;
            } else {
                String endMsg = "END_CALL:" + username;
                byte[] data = endMsg.getBytes();
                DatagramPacket packet = new DatagramPacket(data, data.length,
                        InetAddress.getByName(serverHost), UDP_PORT);
                socket.send(packet);
            }
        } catch (Exception e) {
            System.err.println("✗ Error finalizando llamada: " + e.getMessage());
        }

        System.out.println("✓ Llamada finalizada");
    }
    
    /**
     * Cierra completamente el cliente de voz UDP.
     * Finaliza la llamada (si existe) y libera el socket.
     */
    public void close() {
        endCall();
        socket.close();
    }
}

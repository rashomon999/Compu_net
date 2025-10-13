package utils;

import javax.sound.sampled.*;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;

/**
 * Clase utilitaria encargada de reproducir archivos o datos de audio en memoria.
 * 
 * Permite:
 *
 *     Reproducir un archivo .wav directamente desde el sistema de archivos
 *     Reproducir un audio almacenado en memoria como arreglo de bytes
 * 
 * Usa el mismo formato de audio definido en {@link AudioCapturer#AUDIO_FORMAT} para mantener compatibilidad.
 * 
 * @author Maison
 * @version 1.0
 */
public class AudioPlayer {
    
    /**
     * Reproduce un archivo de audio .wav a partir de su nombre o ruta.
     *
     * @param filename nombre o ruta del archivo de audio a reproducir.
     */
    public static void playFile(String filename) {
        try {
            File file = new File(filename);
            // Verifica existencia del archivo
            if (!file.exists()) {
                System.err.println(" Archivo no encontrado: " + file.getAbsolutePath());
                return;
            }

            // Lee el contenido del archivo en bytes
            byte[] data = java.nio.file.Files.readAllBytes(file.toPath());
            // Reproduce el audio cargado
            playAudio(data);

        } catch (IOException e) {
            System.err.println(" Error leyendo el archivo: " + e.getMessage());
        }
    }

    /**
     * Reproduce un audio desde un arreglo de bytes en memoria.
     * 
     * Usa el mismo {@link AudioFormat} que {@link AudioCapturer} para asegurar compatibilidad.
     *
     * @param audioData arreglo de bytes con los datos del audio a reproducir.
     */
    public static void playAudio(byte[] audioData) {
        if (audioData == null || audioData.length == 0) {
            System.err.println(" No hay datos de audio para reproducir");
            return;
        }
        
        System.out.println(" Reproduciendo audio: " + audioData.length + " bytes");
        
        try {
            // Usa el mismo formato que AudioCapturer para evitar errores de decodificación
            AudioFormat format = AudioCapturer.AUDIO_FORMAT;
            
            // Convierte los bytes en un flujo de audio
            ByteArrayInputStream bais = new ByteArrayInputStream(audioData);
            AudioInputStream audioStream = new AudioInputStream(
                bais, format, audioData.length / format.getFrameSize()
            );
            
            // Prepara la línea de salida (altavoz)
            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            if (!AudioSystem.isLineSupported(info)) {
                System.err.println(" Línea de audio no soportada");
                return;
            }
            
            // Abre y activa el altavoz
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(info);
            speaker.open(format);
            speaker.start();
            
            // Reproduce en bloques de 4KB
            byte[] buffer = new byte[4096];
            int bytesRead;
            int totalBytesRead = 0;
            
            while ((bytesRead = audioStream.read(buffer, 0, buffer.length)) != -1) {
                speaker.write(buffer, 0, bytesRead);
                totalBytesRead += bytesRead;
            }
            
            // Limpia y cierra recursos
            speaker.drain();
            speaker.close();
            audioStream.close();
            
            System.out.println(" Reproducción completada (" + totalBytesRead + " bytes)");
            
        } catch (LineUnavailableException e) {
            System.err.println(" Altavoz no disponible. Revisa los dispositivos de audio del sistema.");
        } catch (Exception e) {
            System.err.println(" Error reproduciendo audio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Método de prueba principal.
     * 
     * Permite capturar y luego reproducir 3 segundos de audio usando
     * {@link AudioCapturer#captureAudio(int)}.
     */
    public static void main(String[] args) {
        System.out.println(" Probando reproducción de audio...");
        System.out.println(" Primero graba 3 segundos...");
        
        // Captura 3 segundos de audio desde el micrófono
        byte[] audio = AudioCapturer.captureAudio(3);
        
        if (audio != null) {
            System.out.println("\n Ahora reproduciendo...");
            try {
                Thread.sleep(500); // Pequeña pausa
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            playAudio(audio);
        } else {
            System.out.println(" No se pudo capturar audio para reproducir");
        }
    }
}
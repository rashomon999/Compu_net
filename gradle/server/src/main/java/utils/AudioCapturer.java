package utils;

import javax.sound.sampled.*;
import java.io.ByteArrayOutputStream;

/**
 * Permite capturar audio desde el micrófono del sistema utilizando el API
 * {@link javax.sound.sampled} de Java. 
 * 
 * Características principales:
 *
 *   Captura audio en formato PCM lineal, mono, 16 bits, a 16 kHz.
 *   Devuelve los datos grabados como un arreglo de bytes.
 *   Incluye un método de prueba autónomo con barra de progreso.
 *
 * Formato de audio:
 * 
 * sampleRate      = 16000.0 Hz
 * sampleSizeInBits = 16 bits
 * channels         = 1 (mono)
 * signed           = true
 * bigEndian        = false
 * 
 * Uso típico:
 *
 *     byte[] audioData = AudioCapturer.captureAudio(5); // Captura 5 segundos
 *
 *
 * Este componente es utilizado por otros módulos (como {@code AudioPlayer}
 * o clientes UDP) para grabar y enviar datos de voz.
 */

public class AudioCapturer {
    
    /**
     * Formato de audio estándar utilizado para capturar y reproducir voz.
     * Se declara {@code public static} para que otros módulos (por ejemplo,
     * {@code AudioPlayer}) puedan reutilizarlo.
     */
    public static final AudioFormat AUDIO_FORMAT = new AudioFormat(
        16000.0f,        // Frecuencia de muestreo
        16,        // Tamaño de muestra (bits)
        1,                 // channels (mono)
        true,                // Muestras con signo
        false             // Orden de bytes little-endian (mejor compatibilidad)
    );

    /**
     * Captura audio desde el micrófono durante una cantidad específica de segundos.
     *
     * @param durationSeconds duración de la grabación en segundos
     * @return arreglo de bytes con los datos de audio capturados, o {@code null} si ocurre un error
     */
    public static byte[] captureAudio(int durationSeconds) {
        try {
            DataLine.Info info = new DataLine.Info(TargetDataLine.class, AUDIO_FORMAT);
            
            // Verificar compatibilidad del sistema
            if (!AudioSystem.isLineSupported(info)) {
                System.err.println(" Línea de audio no soportada");
                return null;
            }
            
            // Inicializar micrófono
            TargetDataLine microphone = (TargetDataLine) AudioSystem.getLine(info);
            microphone.open(AUDIO_FORMAT);
            microphone.start();
            
            System.out.println("  Grabando...");
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            
            long startTime = System.currentTimeMillis();
            long duration = durationSeconds * 1000L;
            
            // Captura en tiempo real
            while (System.currentTimeMillis() - startTime < duration) {
                int bytesRead = microphone.read(buffer, 0, buffer.length);
                out.write(buffer, 0, bytesRead);
                
                // Mostrar progreso cada segundo aprox.
                long elapsed = System.currentTimeMillis() - startTime;
                int secondsElapsed = (int) (elapsed / 1000);
                if (secondsElapsed < durationSeconds && elapsed % 1000 < 100) {
                    System.out.print(".");
                }
            }
            
            System.out.println("\n Grabación completa!");
            
            // Detener y cerrar micrófono
            microphone.stop();
            microphone.close();
            
            // Obtener los bytes grabados
            byte[] audioData = out.toByteArray();
            System.out.println(" Audio capturado: " + audioData.length + " bytes");
            
            return audioData;
            
        } catch (LineUnavailableException e) {
            System.err.println(" Error: Micrófono no disponible");
            System.err.println("  Verifica los permisos del sistema");
            return null;
        } catch (Exception e) {
            System.err.println(" Error capturando audio: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Método de prueba autónomo.
     * Permite verificar si la captura de audio funciona correctamente.
     *
     * Graba 3 segundos de audio y analiza si contiene silencio.
     */
    public static void main(String[] args) {
        System.out.println(" Probando captura de audio...");
        System.out.println(" Grabando 3 segundos...");
        
        byte[] audio = captureAudio(3);
        
        if (audio != null) {
            System.out.println("Audio capturado: " + audio.length + " bytes");
            
            // Verificar que no sea silencio
            boolean hasSilence = true;
            for (int i = 0; i < Math.min(audio.length, 1000); i++) {
                if (audio[i] != 0) {
                    hasSilence = false;
                    break;
                }
            }
            
            if (hasSilence) {
                System.out.println("  Advertencia: El audio parece estar en silencio");
            } else {
                System.out.println(" Audio contiene datos");
            }
        } else {
            System.out.println(" Falló la captura");
        }
    }
}

package utils;
import javax.sound.sampled.*;
import java.io.ByteArrayOutputStream;

public class AudioCapturer {
    
    // Formato de audio consistente (exportado para que AudioPlayer lo use)
    public static final AudioFormat AUDIO_FORMAT = new AudioFormat(
        16000.0f,  // sampleRate
        16,        // sampleSizeInBits
        1,         // channels (mono)
        true,      // signed
        false      // bigEndian (CAMBIADO A FALSE para mejor compatibilidad)
    );
    
    public static byte[] captureAudio(int durationSeconds) {
        try {
            DataLine.Info info = new DataLine.Info(TargetDataLine.class, AUDIO_FORMAT);
            
            if (!AudioSystem.isLineSupported(info)) {
                System.err.println(" Línea de audio no soportada");
                return null;
            }
            
            TargetDataLine microphone = (TargetDataLine) AudioSystem.getLine(info);
            
            microphone.open(AUDIO_FORMAT);
            microphone.start();
            
            System.out.println("  Grabando...");
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            
            long startTime = System.currentTimeMillis();
            long duration = durationSeconds * 1000L;
            
            while (System.currentTimeMillis() - startTime < duration) {
                int bytesRead = microphone.read(buffer, 0, buffer.length);
                out.write(buffer, 0, bytesRead);
                
                // Mostrar progreso
                long elapsed = System.currentTimeMillis() - startTime;
                int secondsElapsed = (int) (elapsed / 1000);
                if (secondsElapsed < durationSeconds && elapsed % 1000 < 100) {
                    System.out.print(".");
                }
            }
            
            System.out.println("\n Grabación completa!");
            
            microphone.stop();
            microphone.close();
            
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

    // Método de prueba
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

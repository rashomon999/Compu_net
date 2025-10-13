package utils;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 *Clase utilitaria para la gestión de archivos de audio en el sistema.
 * 
 * Permite:
 *
 *     Guardar grabaciones de audio como archivos .wav
 *     Cargar archivos previamente guardados
 *     Eliminar archivos de audio
 *     Listar todos los archivos almacenados
 * 
 * Los archivos se guardan dentro del directorio local {@code audio_files/}.
 */
public class AudioFileManager {
    //Nombre del directorio donde se almacenan los audios 
    private static final String AUDIO_DIR = "audio_files";
    
    /**
     * Constructor que asegura la existencia del directorio de audios.
     * Si no existe, lo crea automáticamente.
     */
    public AudioFileManager() {
        try {
            Files.createDirectories(Paths.get(AUDIO_DIR));
            System.out.println("✓ Directorio de audios disponible: " + AUDIO_DIR);
        } catch (IOException e) {
            System.err.println(" Error creando directorio de audios: " + e.getMessage());
        }
    }
    
    /**
     * Guarda un archivo de audio en disco y retorna el nombre del archivo guardado
     */
    public String saveAudio(byte[] audioData, String sender, String recipient) {
        // Generar un nombre único con marca de tiempo
        try {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));
            String filename = String.format("%s_to_%s_%s.wav", sender, recipient, timestamp);
            Path filePath = Paths.get(AUDIO_DIR, filename);
            
            Files.write(filePath, audioData);
            System.out.println("Audio guardado: " + filename + " (" + audioData.length + " bytes)");
            
            return filename;
        } catch (IOException e) {
            System.err.println(" Error guardando audio: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Carga un archivo de audio previamente guardado
     */
    public byte[] loadAudio(String filename) {
        try {
            Path filePath = Paths.get(AUDIO_DIR, filename);
            
            if (!Files.exists(filePath)) {
                System.err.println(" Archivo de audio no encontrado: " + filename);
                return null;
            }
            
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            System.err.println(" Error cargando audio: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Elimina un archivo de audio especificado
     */
    public boolean deleteAudio(String filename) {
        try {
            Path filePath = Paths.get(AUDIO_DIR, filename);
            return Files.deleteIfExists(filePath);
        } catch (IOException e) {
            System.err.println(" Error eliminando audio: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Lista todos los archivos de audio guardados en el directorio
     */
    public File[] getAllAudioFiles() {
        File dir = new File(AUDIO_DIR);
        return dir.listFiles((d, name) -> name.endsWith(".wav"));
    }
}

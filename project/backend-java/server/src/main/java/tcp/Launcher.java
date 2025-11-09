package tcp;

import java.util.Scanner;

/**
 * Launcher - Punto de entrada único para ejecutar el servidor o cliente
 * Permite ejecutar todo desde una sola clase main
 */
public class Launcher {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║        COMPUNET - LAUNCHER             ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("\nSelecciona qué deseas ejecutar:");
        System.out.println("  1. Iniciar Servidor TCP");
        System.out.println("  2. Conectar Cliente TCP");
        System.out.println("  0. Salir");
        System.out.print("\n> Opción: ");
        
        String choice = scanner.nextLine().trim();
        
        switch (choice) {
            case "1" -> {
                System.out.println("\n[!] Iniciando Servidor...");
                Server.main(new String[]{});
            }
            case "2" -> {
                System.out.println("\n[!] Iniciando Cliente...");
                try {
                    Process process = new ProcessBuilder("java", "-cp", "../../../client/build/classes/main", "tcp.Client").start();
                    // Forward output and error streams
                    new Thread(() -> {
                        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                                new java.io.InputStreamReader(process.getInputStream()))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                System.out.println(line);
                            }
                        } catch (IOException e) {
                            e.printStackTrace();
                        }
                    }).start();
                    process.waitFor();
                } catch (Exception e) {
                    System.out.println("\n[✗] Error iniciando cliente: " + e.getMessage());
                }
            }
            case "0" -> {
                System.out.println("\n[✓] Saliendo...");
                scanner.close();
                System.exit(0);
            }
            default -> {
                System.out.println("\n[✗] Opción inválida");
                scanner.close();
            }
        }
    }
}

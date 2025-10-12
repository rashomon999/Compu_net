# Configuración de Red para Compunet

Este documento explica cómo configurar el servidor y los clientes para que funcionen en una red local (LAN/WiFi).

## Arquitectura del Sistema

El proyecto Compunet utiliza dos protocolos:
- **TCP (Puerto 9090)**: Para mensajes de texto, notas de voz grabadas, y control de sesiones
- **UDP (Puerto 9091)**: Para llamadas de voz en tiempo real (streaming de audio)

## Configuración del Servidor

### 1. Encontrar la IP del PC Servidor

**Windows:**
\`\`\`bash
ipconfig
\`\`\`
Busca "Dirección IPv4" en la interfaz de red activa (ejemplo: `192.168.1.100`)

**Linux/Mac:**
\`\`\`bash
ip addr
# o
ifconfig
\`\`\`
Busca la IP en tu interfaz de red (ejemplo: `192.168.1.100`)

### 2. Configurar el Firewall

Debes permitir conexiones entrantes en los puertos 9090 (TCP) y 9091 (UDP).

**Windows Firewall:**
```powershell
# Permitir TCP puerto 9090
netsh advfirewall firewall add rule name="Compunet TCP" dir=in action=allow protocol=TCP localport=9090

# Permitir UDP puerto 9091
netsh advfirewall firewall add rule name="Compunet UDP" dir=in action=allow protocol=UDP localport=9091

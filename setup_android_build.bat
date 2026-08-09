@echo off
echo Configurando entorno para compilación Android...

:: Verificar si está ejecutándose como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Este script necesita permisos de administrador.
    echo Por favor, ejecuta como administrador.
    pause
    exit /b 1
)

:: Instalar WSL si no está instalado
echo Instalando WSL...
wsl --install -d Ubuntu

:: Esperar a que WSL esté disponible
timeout /t 5

:: Crear script de configuración para Ubuntu
echo Creando script de configuración para Ubuntu...
(
echo #!/bin/bash
echo sudo apt-get update
echo sudo apt-get upgrade -y
echo sudo apt-get install -y python3-pip build-essential git python3 python3-dev ffmpeg libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libportmidi-dev libswscale-dev libavformat-dev libavcodec-dev zlib1g-dev
echo sudo apt-get install -y libgstreamer1.0-dev gstreamer1.0-plugins-{bad,base,good,ugly} gstreamer1.0-{tools,x} libpango1.0-dev libcairo2-dev
echo sudo apt-get install -y build-essential libsqlite3-dev sqlite3 bzip2 libbz2-dev zlib1g-dev libssl-dev openssl libgdbm-dev libgdbm-compat-dev liblzma-dev libreadline-dev libncursesw5-dev libffi-dev uuid-dev
echo sudo pip3 install --upgrade pip
echo sudo pip3 install buildozer
echo sudo apt-get install -y openjdk-17-jdk
echo sudo apt-get install -y automake autoconf libtool
) > ubuntu_setup.sh

:: Copiar el script a WSL y ejecutarlo
echo Copiando script a WSL...
wsl -d Ubuntu -e bash -c "cat > ~/setup.sh" < ubuntu_setup.sh
wsl -d Ubuntu -e bash -c "chmod +x ~/setup.sh"
echo Ejecutando configuración en Ubuntu...
wsl -d Ubuntu -e bash -c "~/setup.sh"

echo Configuración completada.
echo Por favor, reinicia tu computadora antes de intentar compilar la aplicación.
pause
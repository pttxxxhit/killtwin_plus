@echo off
echo Configurando entorno para compilación Android...

:: Verificar Java
java -version 2>nul
if %errorLevel% neq 0 (
    echo Java no está instalado. Por favor, instala Java Development Kit (JDK).
    echo Puedes descargarlo de: https://adoptium.net/
    pause
    exit /b 1
)

:: Crear carpeta para el SDK de Android
if not exist "%LOCALAPPDATA%\Android\Sdk" (
    mkdir "%LOCALAPPDATA%\Android\Sdk"
)

:: Descargar Android Command Line Tools
echo Descargando Android Command Line Tools...
powershell -Command "(New-Object Net.WebClient).DownloadFile('https://dl.google.com/android/repository/commandlinetools-win-8092744_latest.zip', 'cmdline-tools.zip')"

:: Extraer Command Line Tools
echo Extrayendo Command Line Tools...
powershell Expand-Archive cmdline-tools.zip -DestinationPath "%LOCALAPPDATA%\Android\Sdk\cmdline-tools" -Force

:: Configurar variables de entorno
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.8.101-hotspot"
setx PATH "%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools;%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin"

:: Instalar dependencias de Python
echo Instalando dependencias de Python...
python -m pip install --upgrade pip
python -m pip install briefcase

echo Configuración completada.
echo Por favor, asegúrate de tener instalado:
echo 1. Java Development Kit (JDK)
echo 2. Android Studio (opcional, pero recomendado)
echo.
echo Ahora puedes ejecutar: briefcase create android
pause
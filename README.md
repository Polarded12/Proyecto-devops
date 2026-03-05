# Proyecto-devops

Esta es una aplicación sencilla para buscar artículos de constituciones mexicanas.
La estructura de carpetas se ha dividido en dos partes:

- **frontend/**: contiene los archivos estáticos HTML, CSS, JavaScript, y los PDFs.
- **backend/**: servidor Node.js con Express que expone un punto de acceso básico y sirve el contenido estático.

## Ejecutar el proyecto

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar la API/servidor:
   ```bash
   npm start
   ```

   El servidor quedará escuchando en http://localhost:3000 (o el puerto definido en la variable de entorno `PORT`).

   Si ves un error `EADDRINUSE`, significa que el puerto ya está ocupado. Cierra cualquier proceso que esté usando el puerto 3000 o exporta otro puerto antes de empezar:

   ```bash
   # en PowerShell
   $env:PORT = 4000; npm start
   ```

   o mata el proceso existente con `taskkill /PID <pid> /F`.

3. Abrir `http://localhost:3000` en el navegador para usar la aplicación.

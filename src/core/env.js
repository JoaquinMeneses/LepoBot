// Carga el archivo .env usando lo que trae Node (>= 20.12), sin dependencias.
// Igual que dotenv: lee ./.env desde la carpeta donde se ejecuta el bot
// y NO pisa las variables que ya vengan definidas en el entorno (útil en el hosting).
try {
  process.loadEnvFile();
} catch (err) {
  // En producción puede no existir el .env: las variables las da el servicio de hosting
  if (err.code !== "ENOENT") throw err;
}

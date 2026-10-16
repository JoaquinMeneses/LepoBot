// Configuración global del proyecto: lo que comparten todos los módulos.
// Cada módulo tiene además su propio config.js con sus opciones.
export default {
  TZ: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires',

  // Canal del equipo: acá viven los paneles de administración de los módulos
  staffChannelId: '1389406397023649896',
  // Roles con permisos de administración sobre los paneles de todos los módulos
  staffRoleIds: ['1389406395572682790', '1389406395572682787'],
};

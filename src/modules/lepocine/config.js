module.exports = {
  TZ: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires',

  // Canal donde vive el panel de sugerencias
  channelId: process.env.LEPOCINE_CHANNEL_ID || '',
  // Canal del equipo: panel con el botón de elegir película (opcional).
  // Si no se define, el panel público incluye también el botón de elegir.
  staffChannelId: '1389406397023649896',
  // Roles que pueden elegir la película (IDs separados por coma)
  staffRoleIds: ['1389406395572682790', '1389406395572682787'],

  // Dónde se hace el evento: canal de voz si se define, si no "ubicación externa" con texto
  voiceChannelId: process.env.LEPOCINE_VOICE_CHANNEL_ID || '',
  location: 'Lepore´s Club',

  // Función: viernes 21:00 a 23:45
  start: { hour: 21, minute: 0 },
  end: { hour: 23, minute: 45 },

  // Lunes: se publica un panel nuevo. Miércoles: se crea el evento.
  panelHour: 9,
  eventHour: 12,

  // El menú de selección de Discord admite 25 opciones como máximo
  maxSuggestions: 25,
};

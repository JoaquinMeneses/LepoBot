export default {
  TZ: process.env.TIMEZONE || 'America/Argentina/Buenos_Aires',

  // Canal público: acá la comunidad sugiere películas
  channelId: process.env.LEPOCINE_CHANNEL_ID || '',
  // Canal del equipo: acá llega el aviso del lunes, se abre la encuesta y se elige la película
  staffChannelId: '1389406397023649896',
  // Roles que pueden abrir la encuesta y elegir la película
  staffRoleIds: ['1389406395572682790', '1389406395572682787'],

  // Dónde se hace el evento: canal de voz si se define, si no "ubicación externa" con texto
  voiceChannelId: process.env.LEPOCINE_VOICE_CHANNEL_ID || '',
  location: 'Lepore´s Club',

  // Valores que aparecen precargados en el formulario de la encuesta
  defaultDay: 'viernes',
  defaultTime: '21:00',
  // Duración del evento, en minutos (165 = 2 h 45 min)
  durationMinutes: 165,

  // Lunes: hora a la que llega al canal del equipo el aviso para abrir la encuesta
  mondayHour: 9,
  // Todos los días: hora del recordatorio para elegir película (si hay sugerencias sin elegir)
  reminderHour: 12,

  // El menú de selección de Discord admite 25 opciones como máximo
  maxSuggestions: 25,
  // La fecha de la película no puede estar más lejos que esto
  maxDaysAhead: 60,
};

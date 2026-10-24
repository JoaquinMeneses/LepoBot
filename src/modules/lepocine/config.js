import globalConfig from '../../core/config.js';

export default {
  // Compartido con todo el proyecto (src/core/config.js)
  TZ: globalConfig.TZ,
  staffChannelId: globalConfig.staffChannelId,
  staffRoleIds: globalConfig.staffRoleIds,

  // Canal público: acá la comunidad sugiere películas
  channelId: process.env.LEPOCINE_CHANNEL_ID || '',
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

  // Al abrir la encuesta, el bot menciona a @everyone en el canal público para avisar a la comunidad.
  // Necesita el permiso "Mencionar @everyone, @here y todos los roles" en ese canal.
  mentionEveryoneOnOpen: true,

  // El menú de selección de Discord admite 25 opciones como máximo
  maxSuggestions: 25,
  // La fecha de la película no puede estar más lejos que esto
  maxDaysAhead: 60,
};

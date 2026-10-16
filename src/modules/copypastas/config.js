export default {
  // Valores por defecto. Lo que se configure desde el panel del equipo se guarda en la base y tiene prioridad.
  defaultEmoji: '📋',
  defaultChannelId: '1431683265105887324',
  // Cantidad mínima de reacciones con ese emoji para que el bot copie el mensaje
  defaultThreshold: 1,
  maxThreshold: 20,

  // Reacciones de votación que el bot agrega a cada copypasta (verde = a favor, rojo = en contra).
  // Para un emoji personalizado del servidor usá el formato '<:nombre:id>'.
  votes: { up: '✅', down: '❌' },

  // Archivos adjuntos que se copian junto con el texto
  maxAttachments: 4,
  maxAttachmentBytes: 8 * 1024 * 1024, // total por mensaje (el límite de Discord sin boost es 10 MB)
};

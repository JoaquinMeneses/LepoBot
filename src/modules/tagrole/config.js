export default {
  // Rol que se asigna a quien muestra la etiqueta del servidor.
  // Se puede cambiar desde el panel del equipo (lo guardado en la base tiene prioridad).
  defaultRoleId: '1561131410327339059',
  // ¿Quitar el rol cuando la persona deja de mostrar la etiqueta? (también se cambia desde el panel)
  // Solo se quita el rol a quienes se lo dio el bot: los roles asignados a mano no se tocan.
  defaultRemoveOnLoss: true,

  // Hora (0-23) del barrido diario que corrige lo que pasó con el bot apagado. null = sin barrido diario.
  dailySyncHour: 4,

  // Cuántos miembros se piden por página al recorrer el servidor (el máximo de Discord es 1000)
  pageSize: 1000,
};

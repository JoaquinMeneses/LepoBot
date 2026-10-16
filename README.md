# LepoBot

Bot de Discord para las actividades de la comunidad: cumpleaños y organización de películas con Lepocine. El proyecto usa ES modules y todos sus comandos slash comienzan con `lc-` para distinguirlos de los de otros bots.

## Módulos

| Módulo        | Estado          | Descripción                                                                     |
| ------------- | --------------- | ------------------------------------------------------------------------------- |
| `birthdays`   | Disponible      | Registro de cumpleaños y saludo automático diario                               |
| `lepocine`    | Disponible      | Película de la comunidad: encuesta de sugerencias, elección y evento automático |
| `debug`       | Solo desarrollo | Comandos de prueba; todos usan el prefijo `lc-debug-`                           |
| `tournaments` | Planeado        | Torneos internos de LoL                                                         |
| `copypastas`  | Planeado        | Copypastas de la comunidad                                                      |

### Cumpleaños

Cada persona gestiona su cumpleaños desde un panel privado. El bot saluda a las 9:00 (hora de Argentina) en el canal que elijan los admins. La hora se cambia en `src/modules/birthdays/scheduler.js`.

| Comando                  | Descripción                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| `/lc-cumple panel`       | Abre el panel privado para registrar/editar, consultar o borrar cumpleaños |
| `/lc-cumple canal canal` | Define el canal de saludos (requiere permiso _Gestionar servidor_)         |

El panel ofrece un formulario para registrar o editar la fecha, consulta privada del propio cumpleaños, listado de los próximos 10 y borrado con confirmación. El año es opcional; si se registra, el saludo incluye la edad.

Los nacidos el 29/02 se saludan el 28/02 en los años no bisiestos.

### Lepocine

La comunidad ve películas juntos. Todo se maneja con paneles de botones, sin comandos. Hay dos canales: uno **público** (donde la comunidad sugiere) y uno del **equipo** (donde se abre la encuesta y se elige la película).

**Ciclo de una encuesta**

1. **Lunes, 9:00:** llega al canal del equipo un panel con mención a los roles del equipo y el botón **🗳️ Abrir encuesta**.
2. Quien tenga uno de los roles toca el botón y completa un formulario:
   - **Día de la película:** `viernes`, `mañana`, `hoy` o una fecha como `17/10`. Viene precargado con `viernes`.
   - **Hora:** `21`, `21:00`, `21h30`. Viene precargada con `21:00`.
   - **Temática para sugerir** (opcional): por ejemplo `terror` o `años 90`.
3. El bot publica en el canal público un panel nuevo con el día, la hora y la temática, y un botón **➕ Sugerir película**. Cada persona tiene una sugerencia activa (si sugiere de nuevo, reemplaza la anterior) y no se aceptan títulos repetidos. Máximo 25 sugerencias.
4. En el canal del equipo el mismo panel cambia a **🎞️ Elegir película** y **✖️ Cancelar encuesta** (con confirmación, por si se escribió mal el día o la hora).
5. Al elegir una película, el bot **crea el evento del servidor** (`Lepocine: "Película"`, con la temática y quién la sugirió en la descripción), anuncia el enlace en el canal público y cierra la encuesta.

**Recordatorio diario:** todos los días a las 12:00, si hay una encuesta abierta con sugerencias y todavía no se eligió, el bot avisa en el canal del equipo mencionando a los roles. No avisa el mismo día en que se abrió la encuesta ni cuando no hay sugerencias.

**Vencimiento:** si llega la fecha de la película sin haber elegido, la encuesta se marca como vencida y los botones dejan de funcionar.

Los roles se verifican siempre al hacer clic: aunque todos vean los botones del panel del equipo, solo los roles configurados pueden usarlos.

| Comando           | Descripción                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `/lc-lepocine panel` | Publica de nuevo el panel del equipo (requiere _Gestionar servidor_) |

**Configuración** (`src/modules/lepocine/config.js`):

| Opción                        | Descripción                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `staffChannelId`              | Canal del equipo                                           |
| `staffRoleIds`                | Roles que pueden abrir la encuesta y elegir la película    |
| `location`                    | Ubicación (texto) del evento                               |
| `defaultDay` / `defaultTime`  | Valores precargados en el formulario                       |
| `durationMinutes`             | Duración del evento (por defecto 165 = 2 h 45 min)         |
| `mondayHour` / `reminderHour` | Hora del aviso del lunes y del recordatorio diario         |
| `maxDaysAhead`                | Máximo de días hacia adelante para la fecha de la película |

El canal público se define con `LEPOCINE_CHANNEL_ID` en el `.env`. Si preferís un canal de voz en lugar de una ubicación de texto, definí `LEPOCINE_VOICE_CHANNEL_ID`.

**Permisos del bot:** en ambos canales, _Ver canal_, _Enviar mensajes_ e _Insertar enlaces_; en el servidor, _Crear eventos_ y _Gestionar eventos_. Para que las menciones a los roles notifiquen, los roles deben ser mencionables o el bot necesita el permiso de mencionar roles.

## Stack

- [Node.js](https://nodejs.org) **22.13 o superior**
- [discord.js](https://discord.js.org) v14
- SQLite integrado de Node (`node:sqlite`), sin dependencias nativas que compilar
- [node-cron](https://github.com/node-cron/node-cron) para las tareas programadas
- Proyecto nativo ES modules (`"type": "module"`); `.env` se carga con `process.loadEnvFile()` sin dotenv

## Puesta en marcha

### 1. Crear la aplicación en Discord

1. Entrá al [Developer Portal](https://discord.com/developers/applications) y creá una aplicación.
2. En la pestaña **Bot**, usá **Reset Token** y copiá el token (se muestra una sola vez).
3. En **OAuth2 → URL Generator**, marcá los scopes `bot` y `applications.commands` y los permisos indicados arriba.
4. Abrí la URL generada e invitá el bot a tu servidor.

### 2. Configurar el proyecto

```bash
npm install
```

Creá un archivo `.env` en la raíz con:

| Variable                    | Descripción                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`             | Token del bot (pestaña **Bot**). **Es secreto**: nunca lo subas al repo ni lo compartas                                                   |
| `CLIENT_ID`                 | _Application ID_ (pestaña **General Information**)                                                                                        |
| `GUILD_ID`                  | ID de tu servidor de pruebas. Si lo definís, los comandos se registran solo ahí (instantáneo). Si lo dejás vacío se registran globalmente |
| `TIMEZONE`                  | Opcional. Por defecto `America/Argentina/Buenos_Aires`                                                                                    |
| `LEPOCINE_CHANNEL_ID`       | Canal público de Lepocine                                                                                                                 |
| `LEPOCINE_VOICE_CHANNEL_ID` | Opcional. Canal de voz para el evento                                                                                                     |

El archivo `.env` es opcional si las variables ya están definidas en el entorno. No agregues secretos al repositorio.

### 3. Registrar comandos y arrancar

```bash
npm run deploy   # registra los slash commands (repetir al cambiar su definición)
npm start        # arranca el bot
npm run dev      # arranca con recarga automática al guardar el código (los cambios del .env requieren reiniciar)
```

## Estructura

```
src/
├── index.js                  # Cliente de Discord y despacho de interacciones
├── core/
│   ├── env.js                # Carga del .env
│   ├── db.js                 # Conexión SQLite y tablas del core
│   ├── loader.js             # Carga automática de módulos
│   └── deploy-commands.js    # Registro de slash commands
└── modules/
    ├── birthdays/            # Cumpleaños
    ├── lepocine/
    │   ├── index.js          # Definición del módulo
    │   ├── config.js         # Canales, roles y horarios
    │   ├── time.js           # Interpretación de día/hora y zona horaria
    │   ├── repo.js           # Tablas y acceso a datos
    │   ├── service.js        # Paneles, evento y avisos
    │   ├── components.js     # Botones, formularios y menús
    │   ├── command.js        # /lc-lepocine
    │   └── scheduler.js      # Aviso del lunes y recordatorio diario
    └── debug/                # Comandos de prueba (ignorado por git)
data/
└── bot.sqlite                # Base de datos (se crea sola, ignorada por git)
```

## Agregar un módulo

El loader detecta automáticamente cada carpeta dentro de `src/modules/`. Para crear uno nuevo:

1. Creá `src/modules/<nombre>/index.js`.
2. Exportá este objeto:

```js
export default {
  name: 'mi-modulo',
  commands: [{ data: commandData, execute: async (interaction) => {} }],
  components: [{ prefix: 'mi-modulo', handle: async (interaction) => {} }], // opcional: botones, selects y formularios cuyo customId empiece con "mi-modulo:"
  init: (client) => {}, // opcional: tareas programadas, listeners, etc.
};
```

3. Corré `npm run deploy` para registrar los comandos nuevos y reiniciá el bot.

Convenciones del proyecto:

- Todo acceso a la base va en un `repo.js` dentro del módulo, nunca directo desde los comandos.
- Un módulo puede crear sus propias tablas en su `repo.js` con `CREATE TABLE IF NOT EXISTS` (como hace `lepocine`).

## Comandos de prueba (`debug`)

| Comando            | Descripción                                      |
| ------------------ | ------------------------------------------------ |
| `/lc-hola`                | Responde un saludo de prueba                     |
| `/lc-debug-anunciar`      | Fuerza el saludo de cumpleaños de hoy            |
| `/lc-debug-lunes`         | Simula el aviso del lunes de Lepocine            |
| `/lc-debug-aviso`         | Fuerza el recordatorio diario de elegir película |
| `/lc-debug-reiniciar`     | Borra la última encuesta de Lepocine y su evento |

## Hoja de ruta

- [ ] **Torneos internos de LoL**: inscripción, armado de equipos o brackets y seguimiento de resultados
- [ ] **Copypastas**: guardar, buscar y lanzar copypastas de la comunidad
- [ ] Saludos de cumpleaños perdidos: recuperar el saludo si el bot estuvo caído a las 9:00
## Despliegue

El bot necesita un proceso Node.js en ejecución permanente y un entorno con Node.js 22.13 o superior. Configurá las variables necesarias y ejecutá `npm run deploy` una vez (y cada vez que cambien los comandos). En producción, usá las credenciales de la aplicación Discord de producción.

## Seguridad

- `.env` y `data/` están en `.gitignore`. Verificá que nunca se suban al repositorio.
- Si el token se filtra, reseteálo desde el Developer Portal.
- Los comandos `lc-debug-*` son herramientas de desarrollo; no los despliegues en el bot público si no los necesitás.

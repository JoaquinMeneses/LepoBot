# Bot de Discord

## Puesta en marcha
1. `npm install`
2. Copiá `.env.example` a `.env` y completá `DISCORD_TOKEN`, `CLIENT_ID` y `GUILD_ID` (tu server de pruebas).
3. `npm run deploy` (registra los slash commands; repetir cada vez que cambies la definición de un comando)
4. `npm start` (o `npm run dev` para recargar al guardar)

## Invitar el bot
Developer Portal → OAuth2 → URL Generator → scopes `bot` y `applications.commands`,
permisos: *Send Messages* y *View Channels*.

## Agregar un módulo
Creá `src/modules/<nombre>/index.js` exportando `{ name, commands: [{ data, execute }], init?(client) }`.
El loader lo detecta solo.

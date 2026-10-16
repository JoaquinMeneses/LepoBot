const fs = require("node:fs");
const path = require("node:path");
const { Collection } = require("discord.js");

/**
 * Cada carpeta dentro de src/modules/ es un módulo y debe tener un index.js que exporte:
 *   {
 *     name: string,
 *     commands?:   [{ data, execute }],                 // slash commands
 *     components?: [{ prefix, handle(interaction) }],   // botones, selects y modales cuyo customId empiece con "prefix:"
 *     init?(client)
 *   }
 */
function loadModules(client) {
  client.commands = new Collection();
  client.components = [];
  const modulesDir = path.join(__dirname, "..", "modules");

  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mod = require(path.join(modulesDir, entry.name));

    for (const cmd of mod.commands ?? []) {
      client.commands.set(cmd.data.name, cmd);
    }
    for (const comp of mod.components ?? []) {
      client.components.push(comp);
    }
    mod.init?.(client);
    console.log(`[módulo] ${mod.name ?? entry.name} cargado`);
  }
}

// Usado por deploy-commands (no necesita cliente)
function collectCommandsJSON() {
  const modulesDir = path.join(__dirname, "..", "modules");
  const out = [];
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mod = require(path.join(modulesDir, entry.name));
    for (const cmd of mod.commands ?? []) out.push(cmd.data.toJSON());
  }
  return out;
}

module.exports = { loadModules, collectCommandsJSON };

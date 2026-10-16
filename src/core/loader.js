import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Collection } from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Cada carpeta dentro de src/modules/ es un módulo y debe tener un index.js que exporte:
 *   {
 *     name: string,
 *     commands?:   [{ data, execute }],                 // slash commands
 *     components?: [{ prefix, handle(interaction) }],   // botones, selects y modales cuyo customId empiece con "prefix:"
 *     init?(client)
 *   }
 */
export async function loadModules(client) {
  client.commands = new Collection();
  client.components = [];
  const modulesDir = path.join(__dirname, "..", "modules");

  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const { default: mod } = await import(pathToFileURL(path.join(modulesDir, entry.name, "index.js")));

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
export async function collectCommandsJSON() {
  const modulesDir = path.join(__dirname, "..", "modules");
  const out = [];
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const { default: mod } = await import(pathToFileURL(path.join(modulesDir, entry.name, "index.js")));
    for (const cmd of mod.commands ?? []) out.push(cmd.data.toJSON());
  }
  return out;
}

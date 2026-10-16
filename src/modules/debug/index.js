import {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { announceToday } from "../birthdays/scheduler.js";
import * as lepocine from "../lepocine/service.js";

const adminCommand = (name, description) =>
  new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(0);

const NO_CHANNEL =
  "No encuentro los canales de Lepocine. Revisá `LEPOCINE_CHANNEL_ID` en el `.env` y `staffChannelId` en `src/core/config.js`.";

const holaData = new SlashCommandBuilder()
  .setName("lc-hola")
  .setDescription("Comando de prueba");

async function executeLcHola(interaction) {
  await interaction.reply("ola putitos");
}

const cumpleData = adminCommand(
  "lc-debug-cumple",
  "Fuerza el saludo de cumpleaños de hoy (admin)",
);

async function executeLcDebugCumple(interaction) {
  await announceToday(interaction.client);
  await interaction.reply({
    content: "Listo, ejecuté el chequeo de hoy.",
    flags: MessageFlags.Ephemeral,
  });
}

// Simula el mensaje del lunes: llega al canal del equipo para abrir la encuesta
const aperturaData = adminCommand(
  "lc-debug-lepocine-apertura",
  "Lepocine: simula el aviso del lunes para abrir la encuesta (admin)",
);

async function executeLcDebugLepocineApertura(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { status } = await lepocine.mondayPrompt(interaction.client);

  const msg = {
    prompted: "Mandé el aviso del lunes al canal del equipo.",
    "open-round":
      "Ya hay una encuesta abierta, así que republiqué el panel sin mención.",
    "no-channel": NO_CHANNEL,
  }[status];
  await interaction.editReply(msg ?? "Listo.");
}

// Simula el recordatorio diario de elegir película (ignora la regla de "no el día que se abrió")
const recordatorioData = adminCommand(
  "lc-debug-lepocine-recordatorio",
  "Lepocine: prueba el recordatorio diario de elegir película (admin)",
);

async function executeLcDebugLepocineRecordatorio(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { status, channel } = await lepocine.dailyReminder(interaction.client, {
    force: true,
  });

  const msg = {
    sent: `Recordatorio enviado en ${channel}.`,
    "no-round":
      "No hay una encuesta abierta. Abrila desde el panel del equipo.",
    "no-suggestions":
      "La encuesta está abierta pero todavía no hay sugerencias, así que no hay nada que confirmar.",
    "no-channel": NO_CHANNEL,
  }[status];
  await interaction.editReply(msg ?? "Listo.");
}

const reiniciarData = adminCommand(
  "lc-debug-lepocine-reiniciar",
  "Lepocine: borra la última encuesta y su evento (admin)",
);

async function executeLcDebugLepocineReiniciar(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await lepocine.resetLast(interaction.client);

  if (result.status === "no-channel") return interaction.editReply(NO_CHANNEL);
  if (result.status === "nothing") {
    return interaction.editReply("No había ninguna encuesta para borrar.");
  }
  await interaction.editReply(
    `Última encuesta borrada y paneles actualizados.${
      result.eventDeleted
        ? " Borré también el evento."
        : " (No había evento que borrar, o borralo a mano.)"
    }`,
  );
}

export default {
  name: "debug",
  commands: [
    { data: holaData, execute: executeLcHola },
    { data: cumpleData, execute: executeLcDebugCumple },
    { data: aperturaData, execute: executeLcDebugLepocineApertura },
    {
      data: recordatorioData,
      execute: executeLcDebugLepocineRecordatorio,
    },
    {
      data: reiniciarData,
      execute: executeLcDebugLepocineReiniciar,
    },
  ],
};

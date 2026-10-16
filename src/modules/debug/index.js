const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { announceToday } = require("../birthdays/scheduler");
const lepocine = require("../lepocine/service");

const hola = {
  data: new SlashCommandBuilder()
    .setName("hola")
    .setDescription("Comando de prueba"),
  async execute(interaction) {
    await interaction.reply("ola putitos");
  },
};

const anunciar = {
  data: new SlashCommandBuilder()
    .setName("debug-anunciar")
    .setDescription("Fuerza el saludo de cumpleaños de hoy (admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(0),
  async execute(interaction) {
    await announceToday(interaction.client);
    await interaction.reply({
      content: "Listo, ejecuté el chequeo de hoy.",
      flags: MessageFlags.Ephemeral,
    });
  },
};

const lepocineAviso = {
  data: new SlashCommandBuilder()
    .setName("debug-aviso")
    .setDescription("Lepocine: prueba el aviso de falta elegir película (admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(0),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { status, channel } = await lepocine.warnMissing(interaction.client);

    const msg = {
      warned: `Aviso enviado en ${channel}.`,
      "has-night":
        "Ya hay una película elegida para este viernes, no hay nada que avisar. Usá `/debug-reiniciar` para probar de nuevo.",
      "no-channel":
        "No encuentro el canal. Revisá `LEPOCINE_CHANNEL_ID` en el `.env`.",
    }[status];
    await interaction.editReply(msg ?? "Listo.");
  },
};

const lepocineReiniciar = {
  data: new SlashCommandBuilder()
    .setName("debug-reiniciar")
    .setDescription("Lepocine: deshace la elección de esta semana y borra su evento (admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(0),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const r = await lepocine.resetWeek(interaction.client);

    if (r.status === "no-channel") {
      return interaction.editReply(
        "No encuentro el canal. Revisá `LEPOCINE_CHANNEL_ID` en el `.env`.",
      );
    }
    if (r.status === "nothing") {
      return interaction.editReply("No había nada elegido para este viernes.");
    }
    await interaction.editReply(
      `Semana reiniciada y panel reabierto.${
        r.eventDeleted
          ? " Borré también el evento."
          : " (No había evento que borrar, o borralo a mano.)"
      }`,
    );
  },
};

module.exports = {
  name: "debug",
  commands: [hola, anunciar, lepocineAviso, lepocineReiniciar],
};

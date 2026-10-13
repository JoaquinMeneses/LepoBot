const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { announceToday } = require("../birthdays/scheduler");

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

module.exports = { name: "debug", commands: [hola, anunciar] };

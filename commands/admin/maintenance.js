const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const settings = require("../../settings.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");

const SETTINGS_PATH = path.join(__dirname, "..", "..", "settings.js");

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("maintenance")
        .setDescription("Aktif/nonaktifkan mode maintenance (owner only)")
        .addSubcommand((sub) => sub.setName("on").setDescription("Aktifkan maintenance mode"))
        .addSubcommand((sub) => sub.setName("off").setDescription("Nonaktifkan maintenance mode")),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        settings.maintenance.enabled = sub === "on";

        await interaction.reply({
            embeds: [createSuccessEmbed(`Maintenance mode telah **${sub === "on" ? "diaktifkan" : "dinonaktifkan"}**.\n(Catatan: pengaturan ini akan reset saat bot di-restart karena tidak ditulis ulang ke settings.js secara permanen.)`)]
        });
    }
};

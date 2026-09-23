const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    adminOnly: true,
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Kelola sistem ticket")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) => sub.setName("setup").setDescription("Kirim panel ticket di channel ini")),
    async execute(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("ticket_create").setLabel("Create Ticket").setEmoji("🎫").setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({
            embeds: [createInfoEmbed("Butuh bantuan?\nKlik tombol di bawah untuk membuat ticket.", "🎫 SUPPORT CENTER")],
            components: [row]
        });

        await interaction.reply({ embeds: [createSuccessEmbed("Panel ticket berhasil dikirim.")], ephemeral: true });
    }
};

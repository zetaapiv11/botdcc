const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Kunci channel ini (member tidak bisa kirim pesan)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
            await interaction.reply({ embeds: [createSuccessEmbed("🔒 Channel ini telah dikunci.")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal mengunci channel: ${err.message}`)], ephemeral: true });
        }
    }
};

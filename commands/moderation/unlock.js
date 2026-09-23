const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Buka kunci channel ini")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
            await interaction.reply({ embeds: [createSuccessEmbed("🔓 Channel ini telah dibuka kembali.")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal membuka channel: ${err.message}`)], ephemeral: true });
        }
    }
};

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Atur slowmode channel ini")
        .addIntegerOption((o) => o.setName("seconds").setDescription("Detik (0 untuk mematikan)").setRequired(true).setMinValue(0).setMaxValue(21600))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const seconds = interaction.options.getInteger("seconds");
        try {
            await interaction.channel.setRateLimitPerUser(seconds);
            await interaction.reply({
                embeds: [createSuccessEmbed(
                    seconds === 0 ? "Slowmode dimatikan di channel ini." : `Slowmode diatur menjadi **${seconds} detik**.`
                )]
            });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal: ${err.message}`)], ephemeral: true });
        }
    }
};

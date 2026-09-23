const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Hapus sejumlah pesan di channel ini")
        .addIntegerOption((o) => o.setName("amount").setDescription("Jumlah pesan (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        try {
            const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger("amount"), true);
            await interaction.reply({ embeds: [createSuccessEmbed(`Berhasil menghapus ${deleted.size} pesan.`)], ephemeral: true });
            await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
                `**Channel:** ${interaction.channel}\n**Jumlah:** ${deleted.size}\n**Moderator:** ${interaction.user.tag}`,
                "🧹 Messages Cleared"
            ));
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal menghapus pesan (pesan lebih dari 14 hari tidak bisa dihapus massal): ${err.message}`)], ephemeral: true });
        }
    }
};

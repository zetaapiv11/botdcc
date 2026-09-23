const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban user dari server")
        .addStringOption((o) => o.setName("userid").setDescription("ID Discord user yang akan di-unban").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const userId = interaction.options.getString("userid");
        try {
            await interaction.guild.members.unban(userId);
            await interaction.reply({ embeds: [createSuccessEmbed(`User dengan ID \`${userId}\` berhasil di-unban.`)] });
            await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
                `**User ID:** ${userId}\n**Moderator:** ${interaction.user.tag}`, "🔓 Member Unbanned"
            ));
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal unban: ${err.message}`)], ephemeral: true });
        }
    }
};

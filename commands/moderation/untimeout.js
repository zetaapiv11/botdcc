const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Hapus timeout dari member")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan dihapus timeout-nya").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.reply({ embeds: [createErrorEmbed("User tidak ditemukan di server ini.")], ephemeral: true });

        try {
            await member.timeout(null);
            await interaction.reply({ embeds: [createSuccessEmbed(`Timeout ${target.tag} telah dihapus.`)] });
            await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
                `**User:** ${target.tag}\n**Moderator:** ${interaction.user.tag}`, "🔊 Timeout Removed"
            ));
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal: ${err.message}`)], ephemeral: true });
        }
    }
};

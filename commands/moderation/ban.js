const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban member dari server")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan di-ban").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan ban"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "Tidak ada alasan diberikan";
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (member && !member.bannable) {
            return interaction.reply({ embeds: [createErrorEmbed("Aku tidak bisa mem-ban user ini (role lebih tinggi/sama).")], ephemeral: true });
        }

        try {
            await interaction.guild.members.ban(target.id, { reason });
            await interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} berhasil di-ban.\n**Alasan:** ${reason}`, "🔨 Member Banned")] });
            await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
                `**User:** ${target.tag}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Time:** <t:${Math.floor(Date.now()/1000)}:F>`,
                "🔨 Member Banned"
            ));
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal ban: ${err.message}`)], ephemeral: true });
        }
    }
};

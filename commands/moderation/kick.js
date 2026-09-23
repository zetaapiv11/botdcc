const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick member dari server")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan di-kick").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan kick"))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "Tidak ada alasan diberikan";
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ embeds: [createErrorEmbed("User tidak ditemukan di server ini.")], ephemeral: true });
        if (!member.kickable) return interaction.reply({ embeds: [createErrorEmbed("Aku tidak bisa kick user ini.")], ephemeral: true });

        try {
            await member.kick(reason);
            await interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} berhasil di-kick.\n**Alasan:** ${reason}`, "👢 Member Kicked")] });
            await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
                `**User:** ${target.tag}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Time:** <t:${Math.floor(Date.now()/1000)}:F>`,
                "👢 Member Kicked"
            ));
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal kick: ${err.message}`)], ephemeral: true });
        }
    }
};

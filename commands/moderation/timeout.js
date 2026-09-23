const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout (mute) member untuk beberapa menit")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan di-timeout").setRequired(true))
        .addIntegerOption((o) => o.setName("minutes").setDescription("Durasi dalam menit").setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan timeout"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const minutes = interaction.options.getInteger("minutes");
        const reason = interaction.options.getString("reason") || "Tidak ada alasan diberikan";
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member || !member.moderatable) {
            return interaction.reply({ embeds: [createErrorEmbed("Aku tidak bisa timeout user ini.")], ephemeral: true });
        }

        try {
            await member.timeout(minutes * 60 * 1000, reason);
            await interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} di-timeout selama ${minutes} menit.\n**Alasan:** ${reason}`, "🔇 Member Timed Out")] });
            await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
                `**User:** ${target.tag}\n**Durasi:** ${minutes} menit\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
                "🔇 Member Timed Out"
            ));
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal timeout: ${err.message}`)], ephemeral: true });
        }
    }
};

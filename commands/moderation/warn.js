const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Beri peringatan kepada member")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan diperingatkan").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan warning").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        const warnings = db.addWarning(interaction.guild.id, target.id, {
            reason,
            moderator: interaction.user.tag,
            timestamp: Date.now()
        });

        await interaction.reply({ embeds: [createSuccessEmbed(`${target} telah diperingatkan.\n**Alasan:** ${reason}\n**Total warning:** ${warnings.length}`, "⚠️ Member Warned")] });
        await logger.sendLog(interaction.client, interaction.guild.id, createSuccessEmbed(
            `**User:** ${target.tag}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Total Warning:** ${warnings.length}`,
            "⚠️ Member Warned"
        ));
    }
};

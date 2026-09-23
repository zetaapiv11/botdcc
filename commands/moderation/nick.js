const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("nick")
        .setDescription("Ubah nickname member")
        .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
        .addStringOption((o) => o.setName("nickname").setDescription("Nickname baru (kosongkan untuk reset)"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const nickname = interaction.options.getString("nickname") || null;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ embeds: [createErrorEmbed("User tidak ditemukan.")], ephemeral: true });

        try {
            await member.setNickname(nickname);
            await interaction.reply({ embeds: [createSuccessEmbed(nickname ? `Nickname ${target.tag} diubah menjadi **${nickname}**.` : `Nickname ${target.tag} telah direset.`)] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal mengubah nickname: ${err.message}`)], ephemeral: true });
        }
    }
};

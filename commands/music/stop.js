const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");
const settings = require("../../settings.js");

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Hentikan musik, hapus antrian, dan keluar dari voice channel"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        try {
            const voice = queue.voice;
            await queue.stop();
            // DisTube v5: queue.stop() tidak lagi otomatis keluar voice channel,
            // jadi kita tegakkan sendiri sesuai settings.music.leaveOnStop.
            if (settings.music.leaveOnStop) {
                voice?.leave();
            }
            await interaction.reply({ embeds: [createSuccessEmbed("Musik dihentikan dan antrian dihapus.", "⏹️ Stop")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal menghentikan musik: \`${err.message}\``)], ephemeral: true });
        }
    }
};
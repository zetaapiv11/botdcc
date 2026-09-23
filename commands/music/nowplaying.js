const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");
const { requireQueue } = require("../../utils/musicChecks.js");
const { loopLabel, progressBar } = require("../../utils/music.js");

module.exports = {
    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Lihat lagu yang sedang diputar"),
    category: "music",
    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (!queue) return;

        const song = queue.songs[0];
        if (!song) {
            return interaction.reply({ embeds: [createInfoEmbed("Tidak ada lagu yang sedang diputar.")], ephemeral: true });
        }

        const bar = progressBar(queue.currentTime, song.duration);
        const current = queue.formattedCurrentTime ?? "00:00";
        const total = song.formattedDuration ?? "??:??";

        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**[${song.name}](${song.url})**\n\n` +
                        `${bar}\n\`${current} / ${total}\`\n\n` +
                        `🎧 Diminta oleh: ${song.user ?? "Tidak diketahui"}\n` +
                        `🔊 Volume: \`${queue.volume}%\` | 🔁 Loop: \`${loopLabel(queue.repeatMode)}\` | ▶️ Autoplay: \`${
                            queue.autoplay ? "Aktif" : "Nonaktif"
                        }\``,
                    "🎶 Now Playing"
                ).setThumbnail(song.thumbnail || null)
            ]
        });
    }
};

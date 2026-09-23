const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");
const { requireQueue } = require("../../utils/musicChecks.js");
const { loopLabel } = require("../../utils/music.js");

const MAX_SHOWN = 15;

module.exports = {
    data: new SlashCommandBuilder().setName("queue").setDescription("Lihat daftar antrian musik"),
    category: "music",
    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (!queue) return;

        const shown = queue.songs.slice(0, MAX_SHOWN);
        const lines = shown.map((song, i) => {
            const prefix = i === 0 ? "🎶 **Sedang Diputar:**" : `**${i}.**`;
            return `${prefix} [${song.name}](${song.url}) \`[${song.formattedDuration}]\``;
        });

        const remaining = queue.songs.length - shown.length;
        const more = remaining > 0 ? `\n...dan **${remaining}** lagu lainnya.` : "";

        const description =
            `${lines.join("\n")}${more}\n\n` +
            `🔊 Volume: \`${queue.volume}%\` | 🔁 Loop: \`${loopLabel(queue.repeatMode)}\` | ▶️ Autoplay: \`${
                queue.autoplay ? "Aktif" : "Nonaktif"
            }\``;

        await interaction.reply({
            embeds: [createInfoEmbed(description, `📜 Antrian Musik (${queue.songs.length} lagu)`)]
        });
    }
};

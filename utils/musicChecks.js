const { createErrorEmbed } = require("./embeds.js");

/**
 * Memastikan user berada di voice channel, dan (jika bot sedang aktif di sebuah
 * voice channel) memastikan user berada di voice channel yang sama dengan bot.
 */
function checkVoiceChannel(interaction) {
    const queue = interaction.client.distube?.getQueue(interaction.guildId);
    const memberVoice = interaction.member.voice?.channel;

    if (!memberVoice) {
        return { ok: false, reason: "Kamu harus join voice channel terlebih dahulu!" };
    }

    if (queue?.voiceChannel && queue.voiceChannel.id !== memberVoice.id) {
        return { ok: false, reason: `Kamu harus berada di voice channel yang sama dengan bot: <#${queue.voiceChannel.id}>` };
    }

    return { ok: true, queue, memberVoice };
}

/**
 * Reply error jika tidak ada queue aktif di guild ini. Mengembalikan queue jika ada.
 */
async function requireQueue(interaction) {
    const queue = interaction.client.distube?.getQueue(interaction.guildId);
    if (!queue) {
        await interaction.reply({
            embeds: [createErrorEmbed("Tidak ada musik yang sedang diputar di server ini.")],
            ephemeral: true
        });
        return null;
    }
    return queue;
}

module.exports = { checkVoiceChannel, requireQueue };

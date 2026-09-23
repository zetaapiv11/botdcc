/**
 * ============================================
 *  MUSIC PANEL (v3)
 *  Embed + tombol interaktif untuk "Now Playing", terinspirasi dari
 *  panel bot musik populer (play/pause, skip, favorite, more features).
 * ============================================
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const settings = require("../settings.js");
const { baseEmbed } = require("./embeds.js");
const { loopLabel, progressBar } = require("./musicFormat.js");

function buildNowPlayingEmbed(queue, song) {
    const current = queue.formattedCurrentTime ?? "00:00";
    const total = song.formattedDuration ?? "??:??";
    const bar = progressBar(queue.currentTime, song.duration);

    return baseEmbed(settings.colors.primary)
        .setTitle("🎶 Now Playing")
        .setDescription(
            `**[${song.name}](${song.url})**\n\n` +
                `${bar}\n\`${current} / ${total}\`\n\n` +
                `🎧 Diminta oleh: ${song.user ?? "Tidak diketahui"}`
        )
        .addFields({
            name: "\u200b",
            value:
                `🔊 Volume: \`${queue.volume}%\` • ` +
                `🔁 Loop: \`${loopLabel(queue.repeatMode)}\` • ` +
                `▶️ Autoplay: \`${queue.autoplay ? "Aktif" : "Nonaktif"}\` • ` +
                `${queue.paused ? "⏸️ Dijeda" : "▶️ Diputar"}`
        })
        .setThumbnail(song.thumbnail || null);
}

/**
 * 4 baris kontrol: 3 baris tombol (14 tombol total) + 1 baris select menu buat
 * fitur yang jarang dipakai / butuh teks panjang (bass boost, lirik, favorit).
 * Semua customId diawali "music_" supaya gampang di-routing di buttonHandler/selectMenuHandler.
 */
function buildControlRows(queue) {
    const noQueue = !queue || !queue.songs?.length;
    const noPrevious = noQueue || !queue.previousSongs?.length;
    const noNext = noQueue || (queue.songs.length <= 1 && !queue.autoplay);
    const noVolDown = noQueue || queue.volume <= 0;
    const noVolUp = noQueue || queue.volume >= 150;

    // Baris 1: kontrol playback utama.
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_prev").setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(noPrevious),
        new ButtonBuilder()
            .setCustomId("music_playpause")
            .setEmoji(queue?.paused ? "▶️" : "⏸️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(noNext),
        new ButtonBuilder().setCustomId("music_queue").setEmoji("📜").setLabel("Antrian").setStyle(ButtonStyle.Secondary).setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_fav").setEmoji("❤️").setStyle(ButtonStyle.Secondary).setDisabled(noQueue)
    );

    // Baris 2: shuffle, loop, volume, autoplay toggle.
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_shuffle").setEmoji("🔀").setLabel("Shuffle").setStyle(ButtonStyle.Secondary).setDisabled(noQueue),
        new ButtonBuilder()
            .setCustomId("music_loop")
            .setEmoji("🔁")
            .setLabel(`Loop: ${loopLabel(queue?.repeatMode ?? 0)}`)
            .setStyle(queue?.repeatMode ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_voldown").setEmoji("🔉").setStyle(ButtonStyle.Secondary).setDisabled(noVolDown),
        new ButtonBuilder().setCustomId("music_volup").setEmoji("🔊").setStyle(ButtonStyle.Secondary).setDisabled(noVolUp),
        new ButtonBuilder()
            .setCustomId("music_autoplay")
            .setEmoji("♾️")
            .setLabel(`Autoplay: ${queue?.autoplay ? "On" : "Off"}`)
            .setStyle(queue?.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(noQueue)
    );

    // Baris 3: aksi lain-lain + stop.
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_replay").setEmoji("⏱️").setLabel("Replay").setStyle(ButtonStyle.Secondary).setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_bassboost").setEmoji("🎚️").setLabel("Bass Boost").setStyle(ButtonStyle.Secondary).setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_disconnect").setEmoji("🔌").setLabel("Disconnect").setStyle(ButtonStyle.Secondary).setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹️").setLabel("Stop").setStyle(ButtonStyle.Danger).setDisabled(noQueue)
    );

    // Baris 4: select menu buat fitur yang butuh teks/hasil panjang.
    const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("music_more_menu")
            .setPlaceholder("🧩 More Features...")
            .setDisabled(noQueue)
            .addOptions(
                { label: "Lirik Lagu Ini", value: "lyrics", emoji: "📝" },
                { label: "Favorit Saya", value: "favorites", emoji: "⭐" }
            )
    );

    return [row1, row2, row3, row4];
}

module.exports = { buildNowPlayingEmbed, buildControlRows };

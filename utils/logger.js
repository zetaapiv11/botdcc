const settings = require("../settings.js");
const { getGuild } = require("./database.js");
const { c } = require("./colors.js");

// Hanya jam:menit:detik -> pendek & rapi, TIDAK ada tanggal (sesuai request v2).
function time() {
    return c(new Date().toTimeString().slice(0, 8), "gray");
}

function tag(label, color) {
    return c(`${label}`, color, { bold: true });
}

function line(label, color, msg) {
    return `${time()} ${c("│", "gray")} ${tag(label.padEnd(7, " "), color)} ${c("│", "gray")} ${msg}`;
}

function info(msg) {
    console.log(line("INFO", "cyan", msg));
}

function warn(msg) {
    console.log(line("WARN", "yellow", msg));
}

function error(msg) {
    console.error(line("ERROR", "red", msg));
}

function game(msg) {
    console.log(line("GAME", "magenta", msg));
}

function economy(msg) {
    console.log(line("ECONOMY", "green", msg));
}

function success(msg) {
    console.log(line("OK", "green", msg));
}

/**
 * Kirim embed log ke log channel guild (jika dikonfigurasi),
 * fallback ke global settings.logs.channelId.
 * Tidak pernah throw — kegagalan kirim log tidak boleh membuat bot crash.
 */
async function sendLog(client, guildId, embed) {
    try {
        if (!settings.logs.enabled) return;
        let channelId = settings.logs.channelId;
        if (guildId) {
            const guildConfig = getGuild(guildId);
            if (guildConfig.logChannel) channelId = guildConfig.logChannel;
        }
        if (!channelId) return;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;
        await channel.send({ embeds: [embed] }).catch((err) => {
            warn(`Gagal mengirim log ke channel ${channelId}: ${err.message}`);
        });
    } catch (err) {
        error(`sendLog error: ${err.message}`);
    }
}

module.exports = { info, warn, error, game, economy, success, sendLog };

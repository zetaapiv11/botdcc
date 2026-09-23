const { PermissionsBitField } = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createInfoEmbed, createWarningEmbed } = require("../utils/embeds.js");
const { isModerator } = require("../utils/permissions.js");
const { ansiBlock, dc } = require("../utils/colors.js");
const logger = require("../utils/logger.js");
const { handlePrefixMessage } = require("../handlers/prefixCommandHandler.js");

// State anti-spam in-memory: userId -> array of timestamps
const messageTimestamps = new Map();

function checkSpam(userId) {
    const now = Date.now();
    const windowMs = settings.antiSpam.intervalSeconds * 1000;
    const timestamps = (messageTimestamps.get(userId) || []).filter((t) => now - t < windowMs);
    timestamps.push(now);
    messageTimestamps.set(userId, timestamps);
    return timestamps.length > settings.antiSpam.maxMessages;
}

function checkExcessiveCaps(content) {
    if (content.length < 10) return false;
    const letters = content.replace(/[^a-zA-Z]/g, "");
    if (letters.length < 10) return false;
    const caps = letters.replace(/[^A-Z]/g, "");
    return (caps.length / letters.length) * 100 >= settings.antiSpam.maxCapsPercent;
}

async function handleAntiSpam(message) {
    if (!settings.antiSpam.enabled) return false;
    if (isModerator(message.member)) return false;

    const violations = [];
    if (checkSpam(message.author.id)) violations.push("mengirim pesan terlalu cepat (spam)");
    if (message.mentions.users.size > settings.antiSpam.maxMentions) violations.push("mention spam");
    if (checkExcessiveCaps(message.content)) violations.push("terlalu banyak huruf kapital");

    if (violations.length === 0) return false;

    try {
        if (message.member?.moderatable) {
            await message.member.timeout(
                settings.antiSpam.muteMinutes * 60 * 1000,
                `Anti-spam: ${violations.join(", ")}`
            );
        }
        await message.channel.send({
            embeds: [
                createWarningEmbed(
                    `${message.author} terkena timeout ${settings.antiSpam.muteMinutes} menit karena: ${violations.join(", ")}.`,
                    "🛡️ Anti-Spam"
                )
            ]
        });
        await logger.sendLog(
            message.client,
            message.guild.id,
            createWarningEmbed(`**User:** ${message.author.tag}\n**Alasan:** ${violations.join(", ")}`, "🛡️ Anti-Spam Action")
        );
    } catch (err) {
        logger.error(`Anti-spam action gagal: ${err.message}`);
    }
    return true;
}

function xpForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
}

async function handleLeveling(message) {
    if (!settings.leveling.enabled) return;
    const guildConfig = db.getGuild(message.guild.id);
    if (!guildConfig.leveling) return;

    const user = db.getUser(message.author.id);
    const now = Date.now();
    if (now - (user.lastMessageXp || 0) < settings.leveling.cooldownSeconds * 1000) return;

    const gain =
        Math.floor(Math.random() * (settings.leveling.xpPerMessage.max - settings.leveling.xpPerMessage.min + 1)) +
        settings.leveling.xpPerMessage.min;

    let newXp = (user.xp || 0) + gain;
    let newLevel = user.level || 0;
    let leveledUp = false;

    while (newXp >= xpForLevel(newLevel)) {
        newXp -= xpForLevel(newLevel);
        newLevel++;
        leveledUp = true;
    }

    db.updateUser(message.author.id, { xp: newXp, level: newLevel, lastMessageXp: now });

    if (leveledUp) {
        const channelId = settings.leveling.levelUpChannelId;
        const channel = channelId ? await message.guild.channels.fetch(channelId).catch(() => null) : message.channel;
        if (channel) {
            const xpNeeded = xpForLevel(newLevel);
            const barLen = 20;
            const filled = Math.max(0, Math.min(barLen, Math.round((newXp / xpNeeded) * barLen)));
            const bar = dc("█".repeat(filled), "green", true) + dc("░".repeat(barLen - filled), "gray");
            const block =
                `${dc("LEVEL", "yellow", true)} ${dc(String(newLevel), "yellow", true)}\n` +
                `${bar}\n` +
                `${dc(`${newXp} / ${xpNeeded} XP`, "cyan")}`;

            await channel.send({
                embeds: [
                    createInfoEmbed(`Selamat ${message.author}! Kamu naik level.\n\n${ansiBlock(block)}`, "🎉 LEVEL UP!")
                ]
            }).catch(() => {});
        }
    }
}

async function handleAfk(message) {
    const db_ = db.getDB();

    // Jika user yang tadinya AFK kembali mengirim pesan, hapus status AFK-nya
    if (db_.afk[message.author.id]) {
        delete db_.afk[message.author.id];
        db.save();
        message.reply({
            embeds: [createInfoEmbed(`Selamat datang kembali ${message.author}, status AFK dihapus.`)]
        }).then((m) => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    }

    // Jika ada mention ke user yang sedang AFK, beritahu
    for (const [, mentioned] of message.mentions.users) {
        const afkData = db_.afk[mentioned.id];
        if (afkData) {
            message.reply({
                embeds: [createInfoEmbed(`${mentioned.username} sedang AFK: ${afkData.reason}`)]
            }).catch(() => {});
        }
    }
}

module.exports = {
    name: "messageCreate",
    once: false,
    async execute(message) {
        try {
            if (message.author.bot || !message.guild) return;

            const wasSpam = await handleAntiSpam(message);
            if (wasSpam) return;

            // Z-command (prefixless text command) — dicek SEBELUM AFK/leveling.
            // Jika pesan adalah command yang valid, hentikan di sini (tidak perlu AFK check / XP leveling).
            // Jika bukan command sama sekali, handlePrefixMessage tidak melakukan apapun (termasuk tidak ada DB write).
            const wasCommand = await handlePrefixMessage(message);
            if (wasCommand) return;

            await handleAfk(message);
            await handleLeveling(message);
        } catch (err) {
            logger.error(`messageCreate error: ${err.message}`);
        }
    }
};

const { AttachmentBuilder } = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createInfoEmbed, createErrorEmbed } = require("../utils/embeds.js");
const logger = require("../utils/logger.js");
const { generateCard } = require("../utils/welcomeCard.js");

// Menyimpan timestamp join per-guild untuk deteksi anti-raid sederhana
const joinTimestamps = new Map();

function formatMessage(template, member) {
    return template
        .replace(/{user}/g, `${member}`)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount);
}

async function handleWelcome(member) {
    if (!settings.welcome.enabled) return;
    const guildConfig = db.getGuild(member.guild.id);
    const channelId = guildConfig.welcomeChannel || settings.welcome.channelId;
    if (!channelId) return;

    try {
        const channel = await member.guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const text = formatMessage(settings.welcome.message, member);
        const embed = createInfoEmbed(text, `👋 Selamat Datang di ${member.guild.name}!`);

        // Coba generate banner gambar (avatar + nama + member count) biar lebih rapi.
        // Otomatis fallback ke embed teks biasa kalau canvas tidak tersedia/gagal.
        if (settings.welcome.useCard) {
            const cardBuffer = await generateCard(member, "join");
            if (cardBuffer) {
                const attachment = new AttachmentBuilder(cardBuffer, { name: "welcome.png" });
                embed.setImage("attachment://welcome.png");
                await channel.send({ embeds: [embed], files: [attachment] });
                return;
            }
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        logger.error(`Gagal mengirim welcome message: ${err.message}`);
    }
}

async function handleAutoRole(member) {
    if (!settings.autoRole.enabled) return;
    const guildConfig = db.getGuild(member.guild.id);
    const roleId = guildConfig.autoRole || settings.autoRole.roleId;
    if (!roleId) return;

    try {
        const role = member.guild.roles.cache.get(roleId);
        if (!role) {
            logger.warn(`Auto-role: role ${roleId} tidak ditemukan di guild ${member.guild.id}`);
            return;
        }
        await member.roles.add(role);
    } catch (err) {
        // Jangan pernah crash — cukup log error (permission kurang, dsb.)
        logger.error(`Gagal memberikan auto-role: ${err.message}`);
        await logger.sendLog(
            member.client,
            member.guild.id,
            createErrorEmbed(`Gagal memberikan auto-role ke ${member}: ${err.message}`)
        );
    }
}

async function handleAntiRaid(member) {
    if (!settings.antiRaid.enabled) return;
    const guildId = member.guild.id;
    const now = Date.now();

    if (!joinTimestamps.has(guildId)) joinTimestamps.set(guildId, []);
    const timestamps = joinTimestamps.get(guildId).filter(
        (t) => now - t < settings.antiRaid.intervalSeconds * 1000
    );
    timestamps.push(now);
    joinTimestamps.set(guildId, timestamps);

    if (timestamps.length >= settings.antiRaid.joinThreshold) {
        joinTimestamps.set(guildId, []); // reset supaya tidak spam alert berulang-ulang
        const alertChannelId = settings.antiRaid.alertChannelId || db.getGuild(guildId).logChannel;
        if (alertChannelId) {
            const channel = await member.guild.channels.fetch(alertChannelId).catch(() => null);
            if (channel) {
                await channel.send({
                    embeds: [
                        createErrorEmbed(
                            `Terdeteksi ${timestamps.length} member join dalam ${settings.antiRaid.intervalSeconds} detik.\n` +
                                `Moderator dapat mengaktifkan lockdown server jika diperlukan menggunakan \`/lock\`.`,
                            "🚨 POSSIBLE RAID DETECTED"
                        )
                    ]
                });
            }
        }
    }
}

module.exports = {
    name: "guildMemberAdd",
    once: false,
    async execute(member) {
        try {
            await handleWelcome(member);
            await handleAutoRole(member);
            await handleAntiRaid(member);
            await logger.sendLog(
                member.client,
                member.guild.id,
                createInfoEmbed(`${member} (${member.user.tag}) bergabung ke server.`, "📥 Member Join")
            );
        } catch (err) {
            logger.error(`guildMemberAdd error: ${err.message}`);
        }
    }
};

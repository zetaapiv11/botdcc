const { AttachmentBuilder } = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createInfoEmbed } = require("../utils/embeds.js");
const logger = require("../utils/logger.js");
const { generateCard } = require("../utils/welcomeCard.js");

function formatMessage(template, member) {
    return template
        .replace(/{user}/g, `${member}`)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount);
}

module.exports = {
    name: "guildMemberRemove",
    once: false,
    async execute(member) {
        try {
            if (settings.goodbye.enabled) {
                const guildConfig = db.getGuild(member.guild.id);
                const channelId = guildConfig.goodbyeChannel || settings.goodbye.channelId;
                if (channelId) {
                    const channel = await member.guild.channels.fetch(channelId).catch(() => null);
                    if (channel && channel.isTextBased()) {
                        const text = formatMessage(settings.goodbye.message, member);
                        const embed = createInfoEmbed(text, "👋 Member Left");

                        if (settings.goodbye.useCard) {
                            const cardBuffer = await generateCard(member, "leave");
                            if (cardBuffer) {
                                const attachment = new AttachmentBuilder(cardBuffer, { name: "goodbye.png" });
                                embed.setImage("attachment://goodbye.png");
                                await channel.send({ embeds: [embed], files: [attachment] });
                            } else {
                                await channel.send({ embeds: [embed] });
                            }
                        } else {
                            await channel.send({ embeds: [embed] });
                        }
                    }
                }
            }

            await logger.sendLog(
                member.client,
                member.guild.id,
                createInfoEmbed(
                    `**User:** ${member.user.tag}\n**Username:** ${member.user.username}\n**Member Count:** ${member.guild.memberCount}`,
                    "👋 Member Left"
                )
            );
        } catch (err) {
            logger.error(`guildMemberRemove error: ${err.message}`);
        }
    }
};

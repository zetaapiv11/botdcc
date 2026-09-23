const { Collection } = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createErrorEmbed, createWarningEmbed } = require("../utils/embeds.js");
const { isOwner, isAdmin, isModerator } = require("../utils/permissions.js");
const logger = require("../utils/logger.js");
const { handleButton } = require("../handlers/buttonHandler.js");
const { handleSelectMenu } = require("../handlers/selectMenuHandler.js");

const cooldowns = new Collection();

function checkCooldown(userId, commandName, cooldownSeconds) {
    const key = `${commandName}`;
    if (!cooldowns.has(key)) cooldowns.set(key, new Collection());
    const timestamps = cooldowns.get(key);
    const now = Date.now();
    const cooldownAmount = cooldownSeconds * 1000;

    if (timestamps.has(userId)) {
        const expiration = timestamps.get(userId) + cooldownAmount;
        if (now < expiration) {
            return (expiration - now) / 1000;
        }
    }
    timestamps.set(userId, now);
    return 0;
}

module.exports = {
    name: "interactionCreate",
    once: false,
    async execute(interaction, client) {
        try {
            // ---------- BUTTON ----------
            if (interaction.isButton()) {
                return handleButton(interaction, client);
            }

            // ---------- SELECT MENU ----------
            if (interaction.isStringSelectMenu()) {
                return handleSelectMenu(interaction, client);
            }

            // ---------- MODAL ----------
            if (interaction.isModalSubmit()) {
                return; // Modal-modal spesifik ditangani langsung di command yang membuatnya (collector).
            }

            // ---------- SLASH COMMAND ----------
            if (!interaction.isChatInputCommand()) return;

            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            const userId = interaction.user.id;

            // Blacklist check
            if (db.isBlacklisted(userId) && !isOwner(userId)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Kamu telah di-blacklist dan tidak dapat menggunakan bot ini.")],
                    ephemeral: true
                });
            }

            // Maintenance mode check
            if (settings.maintenance.enabled && !isOwner(userId)) {
                return interaction.reply({
                    embeds: [createWarningEmbed(settings.maintenance.message, "🔧 Maintenance Mode")],
                    ephemeral: true
                });
            }

            // Permission check
            if (command.ownerOnly && !isOwner(userId)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Command ini hanya bisa digunakan oleh Owner bot.")],
                    ephemeral: true
                });
            }
            if (command.adminOnly && !isAdmin(interaction.member)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Command ini hanya bisa digunakan oleh Administrator.")],
                    ephemeral: true
                });
            }
            if (command.modOnly && !isModerator(interaction.member)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Command ini hanya bisa digunakan oleh Moderator.")],
                    ephemeral: true
                });
            }

            // Cooldown check
            const cooldownSeconds = command.cooldown ?? settings.cooldowns.defaultCommandCooldown;
            const remaining = checkCooldown(userId, command.data.name, cooldownSeconds);
            if (remaining > 0) {
                return interaction.reply({
                    embeds: [createWarningEmbed(`Tunggu **${remaining.toFixed(1)}s** lagi sebelum menggunakan command ini.`)],
                    ephemeral: true
                });
            }

            // Execute
            await command.execute(interaction, client);

            const database = db.getDB();
            database.stats.commandsUsed = (database.stats.commandsUsed || 0) + 1;
            db.save();
        } catch (err) {
            logger.error(`interactionCreate error: ${err.stack || err.message}`);
            const errorEmbed = createErrorEmbed("Terjadi kesalahan saat menjalankan command ini.");
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
                }
            } catch {
                // Interaksi mungkin sudah expired — abaikan.
            }
        }
    }
};

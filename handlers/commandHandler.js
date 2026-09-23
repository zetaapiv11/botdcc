const fs = require("fs");
const path = require("path");
const { REST, Routes, Collection } = require("discord.js");
const settings = require("../settings.js");
const logger = require("../utils/logger.js");

const COMMANDS_DIR = path.join(__dirname, "..", "commands");

/**
 * Membaca semua file command dari commands/<category>/*.js
 * dan mengisi client.commands (Collection).
 */
function loadCommands(client) {
    client.commands = new Collection();
    const categories = fs.readdirSync(COMMANDS_DIR).filter((f) =>
        fs.statSync(path.join(COMMANDS_DIR, f)).isDirectory()
    );

    let count = 0;
    for (const category of categories) {
        const categoryPath = path.join(COMMANDS_DIR, category);
        const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));

        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (!command?.data || !command?.execute) {
                    logger.warn(`Command ${file} tidak valid (tidak ada 'data' atau 'execute'), dilewati.`);
                    continue;
                }

                command.category = category;
                client.commands.set(command.data.name, command);
                count++;
            } catch (err) {
                logger.error(`Gagal memuat command ${file}: ${err.message}`);
            }
        }
    }

    logger.info(`Berhasil memuat ${count} command.`);
    return client.commands;
}

/**
 * Mendaftarkan slash command ke Discord API.
 * Jika settings.guildId diisi -> register per-guild (instan, cocok untuk development).
 * Jika kosong -> register global (bisa memakan waktu hingga 1 jam untuk propagasi).
 */
async function registerCommands(client) {
    const body = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
    const rest = new REST({ version: "10" }).setToken(settings.token);

    try {
        if (settings.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(settings.clientId, settings.guildId),
                { body }
            );
            logger.info(`Slash command terdaftar ke guild ${settings.guildId} (${body.length} command).`);
        } else {
            await rest.put(Routes.applicationCommands(settings.clientId), { body });
            logger.info(`Slash command terdaftar secara global (${body.length} command).`);
        }
    } catch (err) {
        logger.error(`Gagal mendaftarkan slash command: ${err.message}`);
    }
}

module.exports = { loadCommands, registerCommands };

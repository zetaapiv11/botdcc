const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const settings = require("./settings.js");
const logger = require("./utils/logger.js");
const { printBanner } = require("./utils/banner.js");
const { loadCommands } = require("./handlers/commandHandler.js");
const { loadEvents } = require("./handlers/eventHandler.js");
const { loadPrefixCommands } = require("./handlers/prefixCommandHandler.js");
const { setupMusic } = require("./utils/music.js");
const { startKeepAliveServer } = require("./utils/keepAlive.js");

printBanner();

// Kalau di-deploy di Render dan Environment Variable YT_COOKIES diisi,
// tulis isinya ke cookies.txt saat start. Ini supaya cookies (yang bersifat
// rahasia, setara sesi login akun Google/YouTube) tidak perlu ikut di-commit
// ke GitHub - cukup ditempel sekali di dashboard Render.
if (process.env.YT_COOKIES) {
    try {
        fs.writeFileSync(path.join(__dirname, "cookies.txt"), process.env.YT_COOKIES, "utf8");
        logger.info("cookies.txt ditulis dari Environment Variable YT_COOKIES.");
    } catch (err) {
        logger.error(`Gagal menulis cookies.txt dari YT_COOKIES: ${err.message}`);
    }
}



if (!settings.token) {
    logger.error("Token bot belum diisi! Isi Environment Variable DISCORD_TOKEN di dashboard Render (atau lokal via env var) dengan token bot kamu.");
    process.exit(1);
}
if (!settings.clientId) {
    logger.error("Client ID belum diisi! Isi Environment Variable CLIENT_ID di dashboard Render (atau lokal via env var) dengan Application ID bot kamu.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction, Partials.User]
});

client.commands = new Collection();
client.pendingBroadcasts = new Collection();

// Server HTTP kecil supaya Render (kalau di-deploy sebagai Web Service)
// mendeteksi port aktif dan tidak menganggap deploy gagal. Tidak berpengaruh
// apa pun ke logic bot Discord-nya.
startKeepAliveServer(client);

loadCommands(client);
loadEvents(client);
loadPrefixCommands();
setupMusic(client);

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled promise rejection: ${err?.stack || err}`);
});
process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err?.stack || err}`);
});

client.login(settings.token).catch((err) => {
    logger.error(`Gagal login: ${err.message}`);
    process.exit(1);
});

module.exports = client;

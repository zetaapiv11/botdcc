const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const questService = require("../../../services/quest/questService.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../../utils/embeds.js");

const JOBS = [
    { name: "Developer", emoji: "💻" },
    { name: "Designer", emoji: "🎨" },
    { name: "Programmer", emoji: "👨‍💻" },
    { name: "Chef", emoji: "🍳" },
    { name: "Driver", emoji: "🚗" },
    { name: "Streamer", emoji: "🎥" },
    { name: "Gamer", emoji: "🎮" },
    { name: "Farmer", emoji: "🌾" },
    { name: "Miner", emoji: "⛏️" },
    { name: "Merchant", emoji: "🛒" },
    { name: "Mechanic", emoji: "🔧" },
    { name: "Engineer", emoji: "⚙️" }
];

const COOLDOWN_MS = 30 * 1000;

module.exports = {
    name: "work",
    aliases: [],
    category: "economy",
    description: "Bekerja untuk mendapatkan coin",
    usage: "zwork",
    async execute(message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const now = Date.now();

        if (now - (user.lastWork || 0) < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - user.lastWork)) / 1000);
            return message.reply({ embeds: [createWarningEmbed(`⏳ Kamu masih lelah. Coba lagi dalam **${remaining}s**.`)] });
        }

        const job = JOBS[Math.floor(Math.random() * JOBS.length)];
        const earned = settings.economy.workMin + Math.floor(Math.random() * (settings.economy.workMax - settings.economy.workMin + 1));
        db.updateUser(userId, { balance: (user.balance || 0) + earned, lastWork: now });
        questService.progressQuest(userId, "earn_coins", earned);

        await message.reply({
            embeds: [createSuccessEmbed(`${job.emoji} You worked as a ${job.name.toLowerCase()}.\n\nYou earned:\n**+${earned.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}`, "💼 WORK")]
        });
    }
};

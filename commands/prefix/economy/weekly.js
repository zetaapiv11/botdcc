const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const questService = require("../../../services/quest/questService.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../../utils/embeds.js");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const REWARD = 5000;

module.exports = {
    name: "weekly",
    aliases: [],
    category: "economy",
    description: "Klaim reward mingguan",
    usage: "zweekly",
    async execute(message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const now = Date.now();

        if (now - (user.lastWeekly || 0) < WEEK_MS) {
            const remaining = WEEK_MS - (now - user.lastWeekly);
            const days = Math.floor(remaining / 86400000);
            const hours = Math.floor((remaining % 86400000) / 3600000);
            return message.reply({ embeds: [createWarningEmbed(`⏳ Kamu sudah klaim weekly. Coba lagi dalam **${days}h ${hours}j**.`)] });
        }

        db.updateUser(userId, { balance: (user.balance || 0) + REWARD, lastWeekly: now });
        questService.progressQuest(userId, "earn_coins", REWARD);

        await message.reply({
            embeds: [createSuccessEmbed(`Kamu mendapatkan **${REWARD.toLocaleString("id-ID")}** ${settings.economy.currencyIcon} dari weekly reward!`, "📅 WEEKLY REWARD")]
        });
    }
};

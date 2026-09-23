const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const questService = require("../../../services/quest/questService.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../../utils/embeds.js");

const DAY_MS = 24 * 60 * 60 * 1000;

function rewardForStreak(streak) {
    // Day 1 -> 500, Day 2 -> 700, Day 3 -> 900, Day 4 -> 1200, dst (naik progresif)
    if (streak <= 3) return 500 + (streak - 1) * 200;
    return 900 + (streak - 3) * 300;
}

module.exports = {
    name: "daily",
    aliases: [],
    category: "economy",
    description: "Klaim reward harian (streak-based)",
    usage: "zdaily",
    async execute(message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const now = Date.now();
        const last = user.lastDaily || 0;

        if (now - last < DAY_MS) {
            const remaining = DAY_MS - (now - last);
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            return message.reply({ embeds: [createWarningEmbed(`⏳ Kamu sudah klaim daily. Coba lagi dalam **${hours}j ${minutes}m**.`)] });
        }

        // Streak lanjut kalau klaim masih dalam 48 jam terakhir, reset kalau kelewatan.
        const withinStreakWindow = last !== 0 && now - last <= DAY_MS * 2;
        const newStreak = withinStreakWindow ? (user.dailyStreak || 0) + 1 : 1;
        const reward = rewardForStreak(newStreak);

        db.updateUser(userId, { balance: (user.balance || 0) + reward, lastDaily: now, dailyStreak: newStreak });
        questService.progressQuest(userId, "earn_coins", reward);

        await message.reply({
            embeds: [createSuccessEmbed(
                `Kamu mendapatkan **${reward.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!\n\nDaily Streak: **${newStreak}** 🔥`,
                "🎁 DAILY REWARD"
            )]
        });
    }
};

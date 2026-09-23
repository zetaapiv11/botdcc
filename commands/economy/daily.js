const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder().setName("daily").setDescription("Klaim reward harian"),
    async execute(interaction) {
        const user = db.getUser(interaction.user.id);
        const now = Date.now();
        const cooldownMs = settings.economy.dailyCooldownHours * 60 * 60 * 1000;

        if (now - (user.lastDaily || 0) < cooldownMs) {
            const remaining = cooldownMs - (now - user.lastDaily);
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            return interaction.reply({
                embeds: [createWarningEmbed(`Kamu sudah klaim daily hari ini. Coba lagi dalam **${hours}j ${minutes}m**.`)],
                ephemeral: true
            });
        }

        const newBalance = user.balance + settings.economy.dailyAmount;
        db.updateUser(interaction.user.id, { balance: newBalance, lastDaily: now });

        await interaction.reply({
            embeds: [createSuccessEmbed(`Kamu mendapatkan ${settings.economy.currencyIcon} **${settings.economy.dailyAmount}**!\nSaldo sekarang: ${settings.economy.currencyIcon} ${newBalance}`, "🎁 Daily Reward")]
        });
    }
};

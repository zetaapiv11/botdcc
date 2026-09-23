const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../utils/embeds.js");

const JOBS = ["memperbaiki server", "coding fitur baru", "mengajar member baru", "mendesain logo", "membersihkan channel", "menjadi moderator dadakan"];

module.exports = {
    data: new SlashCommandBuilder().setName("work").setDescription("Bekerja untuk mendapatkan coin"),
    async execute(interaction) {
        const user = db.getUser(interaction.user.id);
        const now = Date.now();
        const cooldownMs = settings.economy.workCooldownHours * 60 * 60 * 1000;

        if (now - (user.lastWork || 0) < cooldownMs) {
            const remaining = cooldownMs - (now - user.lastWork);
            const minutes = Math.ceil(remaining / 60000);
            return interaction.reply({
                embeds: [createWarningEmbed(`Kamu masih lelah. Coba lagi dalam **${minutes} menit**.`)],
                ephemeral: true
            });
        }

        const earned = Math.floor(Math.random() * (settings.economy.workMax - settings.economy.workMin + 1)) + settings.economy.workMin;
        const job = JOBS[Math.floor(Math.random() * JOBS.length)];
        const newBalance = user.balance + earned;
        db.updateUser(interaction.user.id, { balance: newBalance, lastWork: now });

        await interaction.reply({
            embeds: [createSuccessEmbed(`Kamu bekerja dengan ${job} dan mendapatkan ${settings.economy.currencyIcon} **${earned}**!\nSaldo sekarang: ${settings.economy.currencyIcon} ${newBalance}`, "💼 Work")]
        });
    }
};

const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Kirim coin ke user lain")
        .addUserOption((o) => o.setName("user").setDescription("Penerima").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("Jumlah coin").setRequired(true).setMinValue(1)),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        if (target.id === interaction.user.id) {
            return interaction.reply({ embeds: [createErrorEmbed("Kamu tidak bisa mengirim coin ke dirimu sendiri.")], ephemeral: true });
        }
        if (target.bot) {
            return interaction.reply({ embeds: [createErrorEmbed("Kamu tidak bisa mengirim coin ke bot.")], ephemeral: true });
        }

        const sender = db.getUser(interaction.user.id);
        if (sender.balance < amount) {
            return interaction.reply({ embeds: [createErrorEmbed("Saldo kamu tidak cukup.")], ephemeral: true });
        }

        const receiver = db.getUser(target.id);
        db.updateUser(interaction.user.id, { balance: sender.balance - amount });
        db.updateUser(target.id, { balance: receiver.balance + amount });

        await interaction.reply({
            embeds: [createSuccessEmbed(`${interaction.user} mengirim ${settings.economy.currencyIcon} **${amount}** ke ${target}.`, "💸 Transfer Berhasil")]
        });
    }
};

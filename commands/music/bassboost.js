const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");
const { BASS_BOOST_PRESETS } = require("../../utils/music.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bassboost")
        .setDescription("Atur seberapa kuat bass musik yang lagi diputar")
        .addStringOption((o) =>
            o
                .setName("level")
                .setDescription("Level bass boost")
                .setRequired(true)
                .addChoices(
                    { name: "Rendah", value: "rendah" },
                    { name: "Sedang (default)", value: "sedang" },
                    { name: "Tinggi", value: "tinggi" },
                    { name: "Ekstra (rawan pecah di speaker kecil/headset murah)", value: "ekstra" },
                    { name: "Matikan", value: "off" }
                )
        ),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        const level = interaction.options.getString("level", true);

        try {
            if (level === "off") {
                if (queue.filters.has("bassboost")) queue.filters.remove("bassboost");
                return interaction.reply({ embeds: [createSuccessEmbed("Bass boost dimatikan.", "🔊 Bass Boost")] });
            }

            const preset = BASS_BOOST_PRESETS[level];
            // Pakai object {name, value} langsung (bukan cuma nama string) supaya gain-nya
            // benar-benar override preset "bassboost" bawaan, override: true biar bisa ganti
            // level berkali-kali di tengah lagu yang sama tanpa perlu /filter off dulu.
            queue.filters.add({ name: "bassboost", value: preset.value }, true);

            await interaction.reply({
                embeds: [
                    createSuccessEmbed(
                        `Bass boost diset ke **${preset.label}**.` +
                            (level === "ekstra" ? "\n⚠️ Level ini bisa bikin suara pecah di speaker/headset kecil." : ""),
                        "🔊 Bass Boost"
                    )
                ]
            });
        } catch (err) {
            await interaction.reply({
                embeds: [createErrorEmbed(`Gagal mengatur bass boost: \`${err.message}\``)],
                ephemeral: true
            });
        }
    }
};

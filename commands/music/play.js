const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const settings = require("../../settings.js");
const { createErrorEmbed, createInfoEmbed } = require("../../utils/embeds.js");
const { stopGuard } = require("../../utils/voiceGuard.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Putar musik dari YouTube, Spotify, SoundCloud, atau judul lagu")
        .addStringOption((o) =>
            o
                .setName("query")
                .setDescription("Judul lagu, nama artis, atau link YouTube/Spotify/SoundCloud")
                .setRequired(true)
        ),
    category: "music",
    async execute(interaction) {
        const query = interaction.options.getString("query", true);
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                embeds: [createErrorEmbed("Kamu harus join voice channel terlebih dahulu untuk memutar musik!")],
                ephemeral: true
            });
        }

        const botMember = interaction.guild.members.me;
        const permissions = voiceChannel.permissionsFor(botMember);
        if (!permissions?.has(["Connect", "Speak"])) {
            return interaction.reply({
                embeds: [createErrorEmbed("Bot tidak memiliki izin **Connect** dan **Speak** di voice channel tersebut!")],
                ephemeral: true
            });
        }

        const distube = interaction.client.distube;
        if (!distube) {
            return interaction.reply({
                embeds: [createErrorEmbed("Fitur music sedang tidak aktif di bot ini.")],
                ephemeral: true
            });
        }

        const existingQueue = distube.getQueue(interaction.guildId);
        if (existingQueue && existingQueue.songs.length >= settings.music.maxQueueSize) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Antrian sudah penuh (maksimal **${settings.music.maxQueueSize}** lagu).`)],
                ephemeral: true
            });
        }

        // Kalau guild ini belum punya queue DisTube tapi masih ada koneksi voice
        // mentah yang nyangkut (paling sering dari /vcguard, bisa juga sisa
        // koneksi lama yang gagal dibersihkan), DisTube akan menolak join dengan
        // error "This guild already has a voice connection which is not managed
        // by DisTube". Lepas dulu koneksi lama itu supaya DisTube bisa ambil alih.
        if (!existingQueue && getVoiceConnection(interaction.guildId)) {
            stopGuard(interaction.guildId);
        }

        await interaction.deferReply();

        try {
            await distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member
            });

            await interaction.editReply({
                embeds: [createInfoEmbed(`Mencari dan memproses: **${query}**...`, "🔎 Memproses")]
            });
        } catch (err) {
            await interaction.editReply({
                embeds: [createErrorEmbed(`Gagal memutar musik: \`${err.message || err}\``)]
            });
        }
    }
};

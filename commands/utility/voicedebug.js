const dgram = require("dgram");
const { SlashCommandBuilder } = require("discord.js");
const {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    generateDependencyReport,
    getVoiceConnection
} = require("@discordjs/voice");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { isOwner } = require("../../utils/permissions.js");

/**
 * Sadap dgram.createSocket supaya ketahuan paket UDP voice dikirim ke mana
 * dan apakah dibalas. Aman - cuma numpang lihat di level socket Node.js.
 */
function patchDgramForCapture() {
    const originalCreateSocket = dgram.createSocket;
    const captured = [];

    dgram.createSocket = function patchedCreateSocket(...args) {
        const socket = originalCreateSocket.apply(this, args);
        const originalSend = socket.send.bind(socket);

        socket.send = (...sendArgs) => {
            const address = sendArgs.find((a) => typeof a === "string");
            const numbers = sendArgs.filter((a) => typeof a === "number");
            captured.push({ at: Date.now(), type: "send", address, port: numbers[numbers.length - 1] });
            return originalSend(...sendArgs);
        };

        socket.on("message", (msg, rinfo) => {
            captured.push({ at: Date.now(), type: "recv", address: rinfo.address, port: rinfo.port, bytes: msg.length });
        });

        return socket;
    };

    return { captured, restore: () => (dgram.createSocket = originalCreateSocket) };
}

/**
 * Sadap event WebSocket (paket "ws", dipakai internal @discordjs/voice buat
 * konek ke voice gateway Discord yang WSS/TCP). Override WS.prototype.emit
 * supaya ke-capture SEMUA instance WebSocket di proses ini, termasuk yang
 * dibuat oleh module internal @discordjs/voice yang sudah require('ws')
 * duluan sebelum command ini jalan.
 */
function patchWsForCapture() {
    let WS;
    try {
        WS = require("ws");
    } catch {
        return { captured: [], available: false, restore: () => {} };
    }

    const originalEmit = WS.prototype.emit;
    const captured = [];

    WS.prototype.emit = function patchedEmit(event, ...args) {
        if (["open", "close", "error", "unexpected-response"].includes(event)) {
            let detail = "";
            if (event === "error") detail = args[0]?.code || args[0]?.message || String(args[0]);
            if (event === "close") detail = `code=${args[0]} reason=${args[1]?.toString?.() || args[1] || "-"}`;

            captured.push({ at: Date.now(), url: this.url, event, detail });
        }
        return originalEmit.call(this, event, ...args);
    };

    return { captured, available: true, restore: () => (WS.prototype.emit = originalEmit) };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("voicedebug")
        .setDescription("[Owner] Tes koneksi voice mentah (WS + UDP) + tampilkan di tahap mana koneksi macet"),
    category: "utility",
    async execute(interaction) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({
                embeds: [createErrorEmbed("Command ini cuma buat owner bot.")],
                ephemeral: true
            });
        }

        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({
                embeds: [createErrorEmbed("Join voice channel dulu sebelum jalanin tes ini.")],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const report = generateDependencyReport();
        const timeline = [];
        const debugLines = [];
        const start = Date.now();

        getVoiceConnection(interaction.guildId)?.destroy();

        const udp = patchDgramForCapture();
        const ws = patchWsForCapture();

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        connection.on("stateChange", (oldState, newState) => {
            timeline.push(`\`+${Date.now() - start}ms\` ${oldState.status} → **${newState.status}**`);
        });
        connection.on("error", (err) => debugLines.push(`\`+${Date.now() - start}ms\` [connection error] ${err.message}`));
        connection.on("debug", (msg) => debugLines.push(`\`+${Date.now() - start}ms\` [debug] ${msg}`));

        let result;
        let success = false;
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            result = "✅ Berhasil sampai **Ready** — voice handshake sukses, koneksi tidak diblokir.";
            success = true;
        } catch (err) {
            result = `❌ Timeout 30 detik. Detail error: \`${err.message || err}\``;
            connection.destroy();
        } finally {
            udp.restore();
            ws.restore();
        }

        // --- Ringkasan lapisan WebSocket (voice gateway, TCP/WSS) ---
        let wsSummary;
        if (!ws.available) {
            wsSummary = "⚠️ Tidak bisa sadap layer WebSocket (module `ws` tidak ditemukan di node_modules).";
        } else if (!ws.captured.length) {
            wsSummary = "Tidak ada aktivitas WebSocket sama sekali tertangkap (aneh, cek versi @discordjs/voice).";
        } else {
            const urls = [...new Set(ws.captured.map((c) => c.url).filter(Boolean))];
            wsSummary =
                `**Voice gateway host yang dituju:** ${urls.join(", ") || "(tidak diketahui)"}\n` +
                ws.captured
                    .map((c) => `  \`+${c.at - start}ms\` **${c.event}**${c.detail ? ` — ${c.detail}` : ""}`)
                    .join("\n");
        }

        // --- Ringkasan lapisan UDP ---
        const sends = udp.captured.filter((c) => c.type === "send");
        const recvs = udp.captured.filter((c) => c.type === "recv");
        const udpSummary = sends.length
            ? `**UDP terkirim:** ${sends.length} ke ${[...new Set(sends.map((s) => `${s.address}:${s.port}`))].join(", ")}\n**UDP dibalas:** ${recvs.length}`
            : "Belum sempat mencoba kirim UDP sama sekali (gagal duluan di layer WebSocket di atas).";

        const embed = (success ? createSuccessEmbed : createErrorEmbed)(
            `${result}\n\n**Layer WebSocket (voice gateway):**\n${wsSummary}\n\n**Layer UDP (voice media):**\n${udpSummary}\n\n**Debug/error internal library:**\n${debugLines.join("\n") || "(tidak ada)"}\n\n**Timeline status:**\n${timeline.join("\n") || "(tidak ada)"}`,
            "🔧 Voice Debug (mendalam)"
        );

        await interaction.editReply({
            content: `\`\`\`\n${report}\n\`\`\``,
            embeds: [embed]
        });
    }
};
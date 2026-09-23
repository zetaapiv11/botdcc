const path = require("path");
const { DisTube, isVoiceChannelEmpty } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { YtDlpPlugin } = require("@distube/yt-dlp");

const settings = require("../settings.js");
const logger = require("./logger.js");
const db = require("./database.js");
const { startGuard } = require("./voiceGuard.js");
const { createInfoEmbed, createSuccessEmbed, createErrorEmbed } = require("./embeds.js");

/**
 * Cek apakah mode 24/7 (/247) aktif untuk guild ini. Kalau aktif, bot TIDAK
 * boleh auto-leave voice channel walau channel kosong atau antrian habis.
 */
function is247Enabled(guildId) {
    if (!guildId) return false;
    return !!db.getGuild(guildId)?.musicMode247;
}

// Interval "Now Playing" yang live-update progress bar tiap beberapa detik,
// per guild. Di-clear tiap kali lagu ganti/berhenti supaya tidak numpuk/leak.
const npIntervals = new Map();
const NP_UPDATE_INTERVAL_MS = 15000;

function clearNpInterval(guildId) {
    const interval = npIntervals.get(guildId);
    if (interval) {
        clearInterval(interval);
        npIntervals.delete(guildId);
    }
}

/**
 * Setelah DisTube keluar dari voice channel (lagu habis, /stop, channel kosong, dsb),
 * cek apakah guild itu punya /vcguard aktif di database. Kalau iya, sambungkan lagi
 * si VC Guard supaya bot balik "standby" di channel yang dijaga - ini yang bikin
 * catatan di voiceGuard.js ("VC Guard akan otomatis coba reconnect lagi begitu lagu
 * selesai/berhenti") beneran jalan, bukan cuma komentar.
 */
function resumeGuardIfNeeded(client, queue) {
    const guildId = queue?.textChannel?.guildId || queue?.id;
    if (!guildId) return;

    const guildData = db.getGuild(guildId);
    if (!guildData?.vcGuard?.enabled || !guildData.vcGuard.channelId) return;

    // Kasih jeda sebentar biar koneksi DisTube benar-benar selesai di-destroy
    // dulu sebelum VC Guard coba join lagi (hindari race condition).
    setTimeout(async () => {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        try {
            await startGuard(guild, guildData.vcGuard.channelId, guildData.vcGuard.textChannelId);
            logger.info(`[VC-GUARD] Resume guard guild ${guildId} setelah musik berhenti.`);
        } catch (err) {
            logger.error(`[VC-GUARD] Gagal resume guard guild ${guildId} setelah musik berhenti: ${err.message}`);
        }
    }, 2000);
}

// Pastikan ffmpeg-static ditemukan oleh @discordjs/voice / prism-media tanpa perlu install FFmpeg manual di OS.
try {
    process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || require("ffmpeg-static");
} catch {
    // ffmpeg-static tidak terpasang / gagal load -> DisTube akan coba pakai FFmpeg dari system PATH.
}

const { loopLabel, progressBar, statusLine, BASS_BOOST_PRESETS, REPEAT_LABELS } = require("./musicFormat.js");
const { buildNowPlayingEmbed, buildControlRows } = require("./musicPanel.js");
const { ensureYtDlpConfig } = require("./ytdlpConfig.js");

/**
 * Inisialisasi DisTube dan pasang semua event listener-nya.
 * Dipanggil sekali saat bot start, sebelum client.login().
 */
function setupMusic(client) {
    if (!settings.music?.enabled) {
        logger.warn("Fitur music dinonaktifkan (settings.music.enabled = false).");
        return null;
    }

    // Tulis/refresh config global yt-dlp SEBELUM YtDlpPlugin diinisialisasi -
    // lihat utils/ytdlpConfig.js buat penjelasan kenapa ini perlu.
    ensureYtDlpConfig();

    const spotifyOptions = {};
    if (settings.music.spotify?.clientId && settings.music.spotify?.clientSecret) {
        spotifyOptions.api = {
            clientId: settings.music.spotify.clientId,
            clientSecret: settings.music.spotify.clientSecret
        };
    }

    // Catatan: sejak DisTube v5, opsi "leaveOnEmpty" / "leaveOnFinish" / "leaveOnStop" / "emptyCooldown"
    // sudah DIHAPUS dari DisTubeOptions (memasukkannya akan melempar DisTubeError [INVALID_KEY]).
    // Perilaku keluar voice channel sekarang diatur manual lewat event "empty" / "finish" / "disconnect"
    // di bawah (dan lewat command /stop kamu sendiri), jadi settings.music.leaveOnEmpty/leaveOnFinish/leaveOnStop
    // dipakai secara manual di dalam event handler-nya, bukan lagi lewat constructor.
    const distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: true,
        joinNewVoiceChannel: true,
        nsfw: false,
        // Override/tambah filter FFmpeg bawaan DisTube. Filter "bassboost" bawaan DisTube
        // (`bass=g=10`) sengaja diganti ke preset "sedang" di bawah biar default-nya lebih
        // berasa. "8d" juga didaftarkan di sini karena DisTube v5 cuma punya default filter
        // "3d", bukan "8d" - jadi sebelumnya /filter 8d selalu gagal (nama tidak match).
        customFilters: {
            bassboost: BASS_BOOST_PRESETS.sedang.value,
            "8d": "apulsator=hz=0.09",
            pop: "equalizer=f=60:width_type=h:width=100:g=6,equalizer=f=8000:width_type=h:width=4000:g=4",
            soft: "lowpass=f=4000,volume=1.15",
            treble: "treble=g=8"
        },
        plugins: [
            new SpotifyPlugin(spotifyOptions),
            new SoundCloudPlugin(),
            // Catatan penting soal YouTube: sengaja TIDAK pakai @distube/youtube (berbasis
            // ytdl-core) di sini. Extractor berbasis ytdl-core gampang banget rusak setiap
            // YouTube ganti sesuatu di sisi mereka - gejalanya persis error
            // "Failed to find any playable formats" yang muncul di bot ini. yt-dlp (Python,
            // di-update sangat sering oleh komunitasnya) jauh lebih tahan banting, jadi link
            // & pencarian YouTube sekarang lewat YtDlpPlugin juga.
            // `update: true` -> plugin akan cek & download/update binary yt-dlp saat bot start.
            // PENTING (v3): sebelumnya ini di-set `false`. Kalau binary yt-dlp belum pernah
            // ke-download sama sekali di server (VPS baru / node_modules baru), `update:false`
            // bikin plugin TIDAK PUNYA binary sama sekali buat dijalankan -> proses yt-dlp gagal
            // start -> outputnya bukan JSON valid -> persis gejala "eror json di konsol pas play
            // pake link YT" yang sering dilaporkan. Trade-off `update:true` cuma nambah beberapa
            // detik waktu start bot (buat cek versi ke GitHub), jauh lebih aman daripada binary
            // yang hilang/ketinggalan versi. Kalau IP VPS kena rate-limit GitHub (error 403 saat
            // start), lihat README bagian Troubleshooting untuk solusinya.
            // YtDlpPlugin WAJIB jadi plugin TERAKHIR (dukung 900+ situs lain: YouTube, TikTok, Twitter, dsb).
            new YtDlpPlugin({ update: true })
        ]
    });

    distube
        .on("initQueue", (queue) => {
            // Terapkan volume default dari settings.js setiap kali queue baru dibuat.
            queue.volume = settings.music.defaultVolume;
            queue.autoplay = false;
        })
        .on("playSong", async (queue, song) => {
            const guildId = queue.textChannel?.guildId || queue.id;
            clearNpInterval(guildId);

            let message;
            try {
                message = await queue.textChannel?.send({
                    embeds: [buildNowPlayingEmbed(queue, song)],
                    components: buildControlRows(queue)
                });
            } catch {
                return;
            }
            if (!message) return;

            // (v3.1) Live-update progress bar tiap NP_UPDATE_INTERVAL_MS, selama masih
            // lagu yang sama & belum di-pause (kalau di-pause, bar toh tidak bergerak,
            // jadi diskip biar hemat request ke Discord).
            const interval = setInterval(async () => {
                const currentQueue = distube.getQueue(guildId);
                if (!currentQueue || currentQueue.songs?.[0] !== song || currentQueue.stopped) {
                    clearNpInterval(guildId);
                    return;
                }
                if (currentQueue.paused) return;

                try {
                    await message.edit({
                        embeds: [buildNowPlayingEmbed(currentQueue, song)],
                        components: buildControlRows(currentQueue)
                    });
                } catch {
                    clearNpInterval(guildId);
                }
            }, NP_UPDATE_INTERVAL_MS);
            npIntervals.set(guildId, interval);
        })
        .on("addSong", (queue, song) => {
            queue.textChannel
                ?.send({
                    embeds: [
                        createSuccessEmbed(
                            `**[${song.name}](${song.url})** \`[${song.formattedDuration}]\` ditambahkan ke antrian.\n` +
                                `🎧 Diminta oleh: ${song.user ?? "Tidak diketahui"}`,
                            "➕ Ditambahkan ke Antrian"
                        )
                    ]
                })
                .catch(() => {});
        })
        .on("addList", (queue, playlist) => {
            queue.textChannel
                ?.send({
                    embeds: [
                        createSuccessEmbed(
                            `**${playlist.name}** (${playlist.songs.length} lagu) ditambahkan ke antrian.`,
                            "➕ Playlist Ditambahkan"
                        )
                    ]
                })
                .catch(() => {});
        })
        .on("addRelatedSong", (queue, song) => {
            queue.textChannel
                ?.send({
                    embeds: [
                        createInfoEmbed(
                            `Autoplay menambahkan lagu terkait: **[${song.name}](${song.url})**`,
                            "🔁 Autoplay"
                        )
                    ]
                })
                .catch(() => {});
        })
        .on("empty", (queue) => {
            // Catatan: sejak DisTube v5, event "empty" ini tidak lagi di-emit otomatis oleh library.
            // Deteksi channel kosong sekarang dilakukan manual lewat listener "voiceStateUpdate" di bawah,
            // yang juga sudah menghormati mode 24/7 (/247) sebelum event ini di-emit.
            queue.textChannel
                ?.send({
                    embeds: [createInfoEmbed("Voice channel kosong, bot keluar dari voice channel.", "👋 Voice Channel Kosong")]
                })
                .catch(() => {});
        })
        .on("finish", (queue) => {
            const guildId = queue.textChannel?.guildId || queue.id;
            clearNpInterval(guildId);

            const guard247 = is247Enabled(guildId);
            queue.textChannel
                ?.send({
                    embeds: [
                        createInfoEmbed(
                            `Antrian musik telah selesai diputar semua.${guard247 ? "\n\n♾️ Mode 24/7 aktif, bot tetap standby di voice channel." : ""}`,
                            "✅ Antrian Selesai"
                        )
                    ]
                })
                .catch(() => {});
            // DisTube v5 tidak lagi otomatis keluar voice channel saat antrian habis,
            // jadi kita tegakkan sendiri sesuai settings.music.leaveOnFinish - kecuali
            // mode 24/7 (/247) sedang aktif di server ini, maka bot tetap standby.
            if (settings.music.leaveOnFinish && !guard247) {
                queue.voice?.leave();
            }
        })
        .on("disconnect", (queue) => {
            const guildId = queue.textChannel?.guildId || queue.id;
            clearNpInterval(guildId);
            queue.textChannel
                ?.send({ embeds: [createInfoEmbed("Bot terputus dari voice channel.", "👋 Terputus")] })
                .catch(() => {});
            resumeGuardIfNeeded(client, queue);
        })
        .on("noRelated", (queue) => {
            queue.textChannel
                ?.send({
                    embeds: [createErrorEmbed("Tidak dapat menemukan lagu terkait untuk autoplay.", "⚠️ Autoplay Gagal")]
                })
                .catch(() => {});
        })
        .on("error", (error, queue, song) => {
            logger.error(`DisTube error: ${error?.stack || error}`);
            const extra = song ? ` (\`${song.name}\`)` : "";
            const rawMessage = error?.message || String(error);

            // Deteksi beberapa pola error yt-dlp yang paling sering dilaporkan,
            // biar user langsung dapat petunjuk perbaikan, bukan cuma pesan error mentah.
            let hint = "";
            if (/enoent/i.test(rawMessage) && /yt-dlp/i.test(rawMessage)) {
                hint =
                    "\n\n💡 **Kemungkinan penyebab:** binary `yt-dlp` belum berhasil ke-download di server (sering terjadi di hosting dengan IP bersama seperti Replit, biasanya karena rate-limit GitHub). Lihat README bagian **Troubleshooting: Error JSON/ENOENT saat Play Link YouTube**.";
            } else if (/sign in to confirm/i.test(rawMessage)) {
                hint =
                    "\n\n💡 **Kemungkinan penyebab:** YouTube mendeteksi request otomatis dari IP server ini (umum terjadi di hosting cloud/shared kayak Replit/Railway). Sudah ada fallback otomatis di `settings.js` → `music.youtube` (`playerClients`, `jsRuntime`, `forceIpv4`), tapi kalau masih terjadi terus, lihat README bagian **Troubleshooting** untuk opsi cookies.";
            } else if (/json/i.test(rawMessage) && (/unexpected token/i.test(rawMessage) || /position 0/i.test(rawMessage))) {
                hint =
                    "\n\n💡 **Kemungkinan penyebab:** binary `yt-dlp` di server bermasalah/ketinggalan versi. Lihat README bagian **Troubleshooting: Error JSON/ENOENT saat Play Link YouTube**.";
            }

            queue?.textChannel
                ?.send({
                    embeds: [createErrorEmbed(`Terjadi kesalahan saat memutar musik${extra}: \`${rawMessage}\`${hint}`)]
                })
                .catch(() => {});
        });

    // DisTube v5 tidak lagi punya opsi "leaveOnEmpty" bawaan, jadi kita cek manual setiap kali
    // ada perubahan voice state (member join/leave/mute/dsb) apakah voice channel bot jadi kosong.
    if (settings.music.leaveOnEmpty) {
        client.on("voiceStateUpdate", (oldState, newState) => {
            const guildId = oldState.guild?.id || newState.guild?.id;
            if (!guildId) return;

            const queue = distube.getQueue(guildId);
            if (!queue || !queue.voice?.channel) return;

            // Mode 24/7 (/247) aktif -> bot tetap standby walau channel kosong, jangan leave.
            if (is247Enabled(guildId)) return;

            if (isVoiceChannelEmpty(queue.voice.channel)) {
                distube.emit("empty", queue);
                queue.voice.leave();
            }
        });
    }

    client.distube = distube;
    logger.info("Music system (DisTube) berhasil diinisialisasi.");
    return distube;
}

module.exports = { setupMusic, loopLabel, progressBar, statusLine, BASS_BOOST_PRESETS, is247Enabled };
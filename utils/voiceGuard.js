const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");
const logger = require("./logger.js");

/**
 * "VC Guard" - bikin bot bertahan di satu voice channel selama mungkin
 * (berjam-jam / berhari-hari) dan otomatis reconnect kalau koneksi putus
 * (network drop, dipindah, bot di-disconnect paksa, dsb).
 *
 * Catatan penting: ini pakai koneksi voice mentah dari @discordjs/voice,
 * TERPISAH dari DisTube. Kalau kamu pakai /play di guild yang sama,
 * DisTube akan mengambil alih koneksi voice guild itu (itu hal yang wajar
 * di @discordjs/voice - satu guild cuma boleh punya satu voice connection).
 * VC Guard akan otomatis coba reconnect lagi begitu lagu selesai/berhenti
 * dan koneksi DisTube dilepas, selama guard masih aktif (belum di /vcguard off).
 */

// guildId -> { channelId, textChannelId, connection, timer, attempt }
const guards = new Map();

const RECONNECT_BASE_DELAY = 5000; // 5 detik
const RECONNECT_MAX_DELAY = 60000; // 60 detik (cap biar ga makin lama2 nunggu)

function isGuarded(guildId) {
    return guards.has(guildId);
}

function getGuard(guildId) {
    return guards.get(guildId) || null;
}

function attachHandlers(guild, connection, channelId) {
    connection.on("stateChange", (oldState, newState) => {
        logger.info(`[VC-GUARD] ${guild.id}: ${oldState.status} -> ${newState.status}`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        // Kalau guard sudah dimatikan (mis. lewat /vcguard off), biarkan saja putus normal.
        if (!guards.has(guild.id)) return;

        try {
            // Discord kadang cuma pindah voice server (region move) -> koneksi akan
            // otomatis masuk ke Signalling/Connecting lagi tanpa perlu kita ikut campur.
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
            ]);
        } catch {
            // Beneran putus total (di-kick paksa, channel dihapus, UDP session mati, dll)
            // -> jangan biarkan library nyoba sendiri, kita destroy & reconnect manual.
            connection.destroy();
            scheduleReconnect(guild, channelId);
        }
    });

    connection.on("error", (err) => {
        logger.error(`[VC-GUARD] Voice connection error di guild ${guild.id}: ${err.message}`);
    });
}

function connect(guild, channelId) {
    const connection = joinVoiceChannel({
        channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
    });

    attachHandlers(guild, connection, channelId);
    return connection;
}

function scheduleReconnect(guild, channelId, attempt = 1) {
    const state = guards.get(guild.id);
    if (!state) return;

    const delay = Math.min(RECONNECT_BASE_DELAY * attempt, RECONNECT_MAX_DELAY);
    logger.warn(
        `[VC-GUARD] Guild ${guild.id} terputus dari voice channel, reconnect percobaan ke-${attempt} dalam ${delay / 1000}s...`
    );

    clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
        const stillGuarded = guards.get(guild.id);
        if (!stillGuarded) return;

        try {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                logger.error(`[VC-GUARD] Channel ${channelId} di guild ${guild.id} sudah tidak ada, guard dimatikan.`);
                guards.delete(guild.id);
                return;
            }

            const existing = getVoiceConnection(guild.id);
            existing?.destroy();

            const connection = connect(guild, channelId);
            stillGuarded.connection = connection;
            stillGuarded.attempt = 0;

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            logger.info(`[VC-GUARD] Guild ${guild.id} berhasil reconnect ke voice channel ${channelId}.`);
        } catch (err) {
            logger.error(`[VC-GUARD] Reconnect gagal di guild ${guild.id}: ${err.message}`);
            scheduleReconnect(guild, channelId, attempt + 1);
        }
    }, delay);
}

/**
 * Nyalakan guard: bot join channelId dan akan terus dijaga (reconnect otomatis)
 * sampai stopGuard() dipanggil. Lempar error kalau gagal connect pertama kali
 * dalam 30 detik (biasanya berarti UDP voice diblokir di sisi hosting).
 */
async function startGuard(guild, channelId, textChannelId = null) {
    stopGuard(guild.id);

    const connection = connect(guild, channelId);
    guards.set(guild.id, { channelId, textChannelId, connection, timer: null, attempt: 0 });

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (err) {
        // Gagal di awal -> jangan langsung tetap "guarded" tanpa koneksi hidup,
        // biar command pemanggil bisa kasih tahu user & user tidak salah kira sudah aktif.
        guards.delete(guild.id);
        connection.destroy();
        throw err;
    }

    return connection;
}

function stopGuard(guildId) {
    const state = guards.get(guildId);
    if (state) {
        clearTimeout(state.timer);
        guards.delete(guildId);
    }

    // Selalu coba destroy koneksi voice mentah yang masih ada di guild ini,
    // bukan cuma kalau guild-nya lagi tercatat di `guards`. Ini penting supaya
    // fungsi ini juga bisa dipakai sebagai "lepas paksa koneksi lama" sebelum
    // DisTube join (mis. dipanggil dari /play), bukan cuma dari /vcguard off.
    const existing = getVoiceConnection(guildId);
    if (existing) {
        existing.destroy();
        return true;
    }

    return Boolean(state);
}

module.exports = { startGuard, stopGuard, isGuarded, getGuard };

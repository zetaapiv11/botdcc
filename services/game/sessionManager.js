/**
 * ============================================
 *  GAME SESSION MANAGER
 *  Menyimpan state game interaktif (Blackjack, Mines, dst)
 *  yang memakai Discord Buttons.
 *
 *  Fitur anti-exploit:
 *  - Mencegah 1 user membuka 2 sesi game yang sama secara bersamaan
 *  - Auto-timeout + cleanup supaya tidak ada reward ganda / button replay
 * ============================================
 */

const sessions = new Map(); // gameId -> session
const activeByUser = new Map(); // `${type}:${ownerId}` -> gameId

/**
 * @param {string} type - nama game, misal "blackjack", "mines"
 * @param {string} ownerId - user id pemilik game
 * @param {object} data - state game (deck, hand, grid, bet, dst)
 * @param {number} timeoutMs - durasi sebelum game otomatis berakhir
 * @param {(session: object) => void} onTimeout - callback saat game timeout
 * @returns {object|null} session, atau null jika user sudah punya sesi aktif untuk game ini
 */
function createSession(type, ownerId, data, timeoutMs, onTimeout) {
    const activeKey = `${type}:${ownerId}`;
    if (activeByUser.has(activeKey)) {
        return null;
    }

    const gameId = `${type}_${ownerId}_${Date.now()}`;
    const session = {
        id: gameId,
        type,
        ownerId,
        data,
        ended: false,
        createdAt: Date.now()
    };

    session.timeoutHandle = setTimeout(() => {
        if (session.ended) return;
        session.ended = true;
        sessions.delete(gameId);
        activeByUser.delete(activeKey);
        if (typeof onTimeout === "function") {
            Promise.resolve(onTimeout(session)).catch(() => {});
        }
    }, timeoutMs);

    sessions.set(gameId, session);
    activeByUser.set(activeKey, gameId);
    return session;
}

function getSession(gameId) {
    const session = sessions.get(gameId);
    if (!session || session.ended) return null;
    return session;
}

function endSession(gameId) {
    const session = sessions.get(gameId);
    if (!session) return;
    session.ended = true;
    clearTimeout(session.timeoutHandle);
    sessions.delete(gameId);
    activeByUser.delete(`${session.type}:${session.ownerId}`);
}

module.exports = { createSession, getSession, endSession };

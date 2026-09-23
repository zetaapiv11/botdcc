/**
 * ============================================
 *  KEEP ALIVE / HEALTH CHECK SERVER (Render.com)
 * ============================================
 * Discord bot sebenarnya tidak butuh web server - tapi kalau di-deploy
 * sebagai "Web Service" di Render (satu-satunya jenis service yang gratis;
 * "Background Worker" berbayar), Render WAJIB bisa mendeteksi port yang
 * "listening", kalau tidak, deploy akan dianggap gagal setelah beberapa
 * menit. Server kecil ini cuma buat itu - tidak ada logic bot di sini.
 *
 * Render menyuntikkan PORT lewat environment variable secara otomatis,
 * jadi JANGAN hardcode port di sini.
 */
const http = require("http");
const logger = require("./logger.js");

function startKeepAliveServer(client) {
    const port = process.env.PORT || 3000;

    const server = http.createServer((req, res) => {
        const status = client?.isReady?.() ? "online" : "starting";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status, bot: client?.user?.tag || null }));
    });

    server.listen(port, () => {
        logger.info(`Keep-alive HTTP server jalan di port ${port} (untuk Render health check).`);
    });

    return server;
}

module.exports = { startKeepAliveServer };

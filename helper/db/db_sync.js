const db = require('../../src/utils/dbUtil');

// Semua model => node helper/db/db_sync.js
require('./db_all_model');

async function syncDB() {
    try {
        console.log("Sedang melakukan sinkronisasi data...");
        await db.sync({ alter: true });
        // await dbUser.sync();
        console.log("Berhasil melakukan sinkronisasi database.");
    } catch (error) {
        console.error("Gagal melakukan sinkronisasi database:", error);
    }
}

(async () => {
    await syncDB();
})();

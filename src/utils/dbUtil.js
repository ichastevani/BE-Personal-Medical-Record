require('dotenv')
    .config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: 'db.sqlite',
        dialectOptions: {
            charset: 'utf8mb4' // Menggunakan utf8mb4 untuk mendukung karakter Unicode seperti emoji
        },
        logging: process.env.DB_LOG === 'true'
    }
);

module.exports = sequelize;

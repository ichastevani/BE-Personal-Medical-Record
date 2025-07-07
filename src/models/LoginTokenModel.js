const { DataTypes } = require('sequelize');
const db = require('../utils/dbUtil');

const LoginTokenModel = db.define('LoginTokenModel', {
    address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
    },
},{
    tableName: "login_tokens",
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['address', 'token'],
        },
    ],
});

// ekspor model
module.exports = LoginTokenModel;

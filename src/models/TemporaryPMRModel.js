const { DataTypes } = require('sequelize');
const db = require('../utils/dbUtil');

const TemporaryPMRModel = db.define('TemporaryPMRModel', {
    id: {
        type: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    creator_address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    owner_address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tx_hash: {
        type: DataTypes.STRING,
        allowNull: false,
    },
},{
    tableName: "temporary_pmr",
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['creator_address', 'id'],
        },
    ],
});

// ekspor model
module.exports = TemporaryPMRModel;

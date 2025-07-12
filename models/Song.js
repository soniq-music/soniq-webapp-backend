const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Song = sequelize.define('Song', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    album: {
        type: DataTypes.STRING(255),
    },
    url: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    duration: {
        type: DataTypes.FLOAT,
    },
    coverImage: {
        type: DataTypes.TEXT,
    },
    artistUid: {
        type: DataTypes.CHAR(36), // ✅ Now matches
        references: {
            model: 'users',
            key: 'uid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
    },
}, {
    tableName: 'songs',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    freezeTableName: true,
});

module.exports = Song;

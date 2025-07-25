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
        validate: {
            min: 0,
        },
    },
    coverImage: {
        type: DataTypes.TEXT,
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 1900,
            max: new Date().getFullYear(),
        },
    },
    language: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    parentUid: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    artistUid: {
        type: DataTypes.CHAR(36),
        references: {
            model: 'users',
            key: 'uid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
}, {
    tableName: 'songs',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    freezeTableName: true,
});

module.exports = Song;

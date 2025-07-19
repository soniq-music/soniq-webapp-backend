const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uid: {
        type: DataTypes.CHAR(36),
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        validate: { isEmail: true },
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    avatarUrl: {
        type: DataTypes.TEXT,
    },
    role: {
        type: DataTypes.ENUM('user', 'artist', 'admin'),
        allowNull: false,
        defaultValue: 'user',
    },
    passwordResetToken: {
        type: DataTypes.STRING(255),
    },
    passwordResetExpires: {
        type: DataTypes.DATE,
    },
    firstDeviceId: {
        type: DataTypes.STRING(64),
        allowNull: true,
    },
    firstDeviceOS: {
        type: DataTypes.STRING(32),
        allowNull: true,
    },
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    underscored: false,
    freezeTableName: true,
});

module.exports = User;

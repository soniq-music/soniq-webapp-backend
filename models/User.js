const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true },
    },
    password: { type: DataTypes.STRING, allowNull: false },
    avatarUrl: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING, defaultValue: 'user' },
    passwordResetToken: { type: DataTypes.STRING },
    passwordResetExpires: { type: DataTypes.DATE },
}, {
    timestamps: true,
});

module.exports = User;

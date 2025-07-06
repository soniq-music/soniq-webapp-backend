const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Song = sequelize.define('Song', {
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    artist: { type: DataTypes.STRING },
    album: { type: DataTypes.STRING },
    url: { type: DataTypes.STRING, allowNull: false },
    mood: { type: DataTypes.STRING },
    genre: { type: DataTypes.STRING },
    duration: { type: DataTypes.FLOAT },
    coverImage: { type: DataTypes.STRING },
});

module.exports = Song;

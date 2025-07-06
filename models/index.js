const Sequelize = require('sequelize');
const sequelize = require('../config/db');

const Song = require('./Song');
const User = require('./User');

// Set up associations
Song.belongsTo(User, {
    foreignKey: 'artistId',
    as: 'uploader',
});

User.hasMany(Song, {
    foreignKey: 'artistId',
    as: 'songs',
});

module.exports = {
    sequelize,
    Sequelize,
    Song,
    User,
};

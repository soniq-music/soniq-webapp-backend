const Sequelize = require('sequelize');
const sequelize = require('../config/db');

// Import models
const Song = require('./Song');
const User = require('./User');
const Artist = require('./Artist');
const Genre = require('./Genre');
const Mood = require('./Mood');

// ===========================
// Associations
// ===========================

// Song ↔ User (Uploader)
Song.belongsTo(User, {
    foreignKey: 'artistUid',
    targetKey: 'uid',
    as: 'uploader',
});
User.hasMany(Song, {
    foreignKey: 'artistUid',
    sourceKey: 'uid',
    as: 'songs',
});

// Many-to-Many: Song ↔ Artist
Song.belongsToMany(Artist, {
    through: 'song_artists',
    foreignKey: 'songId',
    otherKey: 'artistId',
    as: 'Artists',
});
Artist.belongsToMany(Song, {
    through: 'song_artists',
    foreignKey: 'artistId',
    otherKey: 'songId',
    as: 'Songs',
});

// Many-to-Many: Song ↔ Genre
Song.belongsToMany(Genre, {
    through: 'song_genres',
    foreignKey: 'songId',
    otherKey: 'genreId',
    as: 'Genres',
});
Genre.belongsToMany(Song, {
    through: 'song_genres',
    foreignKey: 'genreId',
    otherKey: 'songId',
    as: 'Songs',
});

// Many-to-Many: Song ↔ Mood
Song.belongsToMany(Mood, {
    through: 'song_moods',
    foreignKey: 'songId',
    otherKey: 'moodId',
    as: 'Moods',
});
Mood.belongsToMany(Song, {
    through: 'song_moods',
    foreignKey: 'moodId',
    otherKey: 'songId',
    as: 'Songs',
});

// ===========================
// Export all models + sequelize instance
// ===========================
module.exports = {
    sequelize,
    Sequelize,
    Song,
    User,
    Artist,
    Genre,
    Mood,
};

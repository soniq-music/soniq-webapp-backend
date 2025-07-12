const Sequelize = require('sequelize');
const sequelize = require('../config/db');

// Models
const Song = require('./Song');
const User = require('./User');
const Artist = require('./Artist');
const Genre = require('./Genre');
const Mood = require('./Mood');

// Associations
Song.belongsTo(User, {
    foreignKey: 'artistUid',
    targetKey: 'uid',  // ✅ Use the correct model field name
    as: 'uploader',
});

// User can have many songs
User.hasMany(Song, {
    foreignKey: 'artistUid',
    sourceKey: 'uid',  // ✅ Also correct here
    as: 'songs',
});


// Many-to-Many: Song ↔ Artist
Song.belongsToMany(Artist, {
    through: 'song_artists',
    foreignKey: 'songId',
    otherKey: 'artistId',
    as: 'Artists'
});
Artist.belongsToMany(Song, {
    through: 'song_artists',
    foreignKey: 'artistId',
    otherKey: 'songId',
    as: 'Songs'
});

// Many-to-Many: Song ↔ Genre
Song.belongsToMany(Genre, {
    through: 'song_genres',
    foreignKey: 'songId',
    otherKey: 'genreId',
    as: 'Genres'
});
Genre.belongsToMany(Song, {
    through: 'song_genres',
    foreignKey: 'genreId',
    otherKey: 'songId',
    as: 'Songs'
});

// Many-to-Many: Song ↔ Mood
Song.belongsToMany(Mood, {
    through: 'song_moods',
    foreignKey: 'songId',
    otherKey: 'moodId',
    as: 'Moods'
});
Mood.belongsToMany(Song, {
    through: 'song_moods',
    foreignKey: 'moodId',
    otherKey: 'songId',
    as: 'Songs'
});

module.exports = {
    sequelize,
    Sequelize,
    Song,
    User,
    Artist,
    Genre,
    Mood
};

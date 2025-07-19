const Sequelize = require('sequelize');
const sequelize = require('../config/db');

// Models
const Song = require('./Song');
const User = require('./User');
const Artist = require('./Artist');
const Genre = require('./Genre');
const Mood = require('./Mood');

// ===========================
// Join Tables (NO uid field)
// ===========================

const SongArtist = sequelize.define('song_artists', {
    songId: { type: Sequelize.INTEGER, primaryKey: true },
    artistId: { type: Sequelize.INTEGER, primaryKey: true },
}, { timestamps: true, freezeTableName: true });

const SongMusicDirector = sequelize.define('song_music_directors', {
    songId: { type: Sequelize.INTEGER, primaryKey: true },
    artistId: { type: Sequelize.INTEGER, primaryKey: true },
}, { timestamps: true, freezeTableName: true });

const SongGenre = sequelize.define('song_genres', {
    songId: { type: Sequelize.INTEGER, primaryKey: true },
    genreId: { type: Sequelize.INTEGER, primaryKey: true },
}, { timestamps: true, freezeTableName: true });

const SongMood = sequelize.define('song_moods', {
    songId: { type: Sequelize.INTEGER, primaryKey: true },
    moodId: { type: Sequelize.INTEGER, primaryKey: true },
}, { timestamps: true, freezeTableName: true });

// ===========================
// Associations
// ===========================

// Song ↔ Uploader (User)
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

// Song ↔ Artists
Song.belongsToMany(Artist, {
    through: SongArtist,
    foreignKey: 'songId',
    otherKey: 'artistId',
    as: 'Artists',
});
Artist.belongsToMany(Song, {
    through: SongArtist,
    foreignKey: 'artistId',
    otherKey: 'songId',
    as: 'Songs',
});

// Song ↔ Music Directors
Song.belongsToMany(Artist, {
    through: SongMusicDirector,
    foreignKey: 'songId',
    otherKey: 'artistId',
    as: 'MusicDirectors',
});
Artist.belongsToMany(Song, {
    through: SongMusicDirector,
    foreignKey: 'artistId',
    otherKey: 'songId',
    as: 'DirectedSongs', // Magic method = artist.getDirectedSongs()
});

// Song ↔ Genres
Song.belongsToMany(Genre, {
    through: SongGenre,
    foreignKey: 'songId',
    otherKey: 'genreId',
    as: 'Genres',
});
Genre.belongsToMany(Song, {
    through: SongGenre,
    foreignKey: 'genreId',
    otherKey: 'songId',
    as: 'Songs',
});

// Song ↔ Moods
Song.belongsToMany(Mood, {
    through: SongMood,
    foreignKey: 'songId',
    otherKey: 'moodId',
    as: 'Moods',
});
Mood.belongsToMany(Song, {
    through: SongMood,
    foreignKey: 'moodId',
    otherKey: 'songId',
    as: 'Songs',
});

// ===========================
// Export All Models
// ===========================

module.exports = {
    sequelize,
    Sequelize,
    Song,
    User,
    Artist,
    Genre,
    Mood,
    SongArtist,
    SongMusicDirector,
    SongGenre,
    SongMood,
};

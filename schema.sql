-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatarUrl TEXT,
    role ENUM('user', 'artist', 'admin') DEFAULT 'user',
    passwordResetToken VARCHAR(255),
    passwordResetExpires DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: songs
CREATE TABLE IF NOT EXISTS songs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid CHAR(36) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    url TEXT NOT NULL,
    duration FLOAT,
    coverImage TEXT,
    artistUid CHAR(36),
    year INT,
    language VARCHAR(50) NOT NULL,
    parentUid CHAR(36),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (artistUid) REFERENCES users (uid) ON UPDATE CASCADE ON DELETE SET NULL
);

-- Table: artists
CREATE TABLE IF NOT EXISTS artists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: genres
CREATE TABLE IF NOT EXISTS genres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: moods
CREATE TABLE IF NOT EXISTS moods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: song_artists
CREATE TABLE IF NOT EXISTS song_artists (
    songId INT NOT NULL,
    artistId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE,
    FOREIGN KEY (artistId) REFERENCES artists (id) ON DELETE CASCADE
);

-- Table: song_genres
CREATE TABLE IF NOT EXISTS song_genres (
    songId INT NOT NULL,
    genreId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE,
    FOREIGN KEY (genreId) REFERENCES genres (id) ON DELETE CASCADE
);

-- Table: song_moods
CREATE TABLE IF NOT EXISTS song_moods (
    songId INT NOT NULL,
    moodId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE,
    FOREIGN KEY (moodId) REFERENCES moods (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS song_music_directors (
    songId INT NOT NULL,
    artistId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE,
    FOREIGN KEY (artistId) REFERENCES artists (id) ON DELETE CASCADE
);
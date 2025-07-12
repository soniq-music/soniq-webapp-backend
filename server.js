const app = require('./app');
const { sequelize } = require('./models'); // Make sure this loads models with associations
const PORT = process.env.PORT || 5000;

// Sync DB and then start server
sequelize.sync({ alter: true }) // Use { force: true } only for dev if you want to drop all tables
    .then(() => {
        console.log('✅ Database synced');
        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to sync database:', err);
    });

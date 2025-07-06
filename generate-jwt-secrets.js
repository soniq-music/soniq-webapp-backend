const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.resolve(__dirname, '.env');

// Function to generate 64-byte hex token
const generateSecret = () => crypto.randomBytes(64).toString('hex');

// Load or initialize .env content
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Replace or append key-value
function setEnvVariable(key, value) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (env.match(regex)) {
        env = env.replace(regex, `${key}=${value}`);
    } else {
        env += `\n${key}=${value}`;
    }
}

// Generate secrets
const accessSecret = generateSecret();
const refreshSecret = generateSecret();

// Set/update values
setEnvVariable('ACCESS_TOKEN_SECRET', accessSecret);
setEnvVariable('REFRESH_TOKEN_SECRET', refreshSecret);

// Write back to .env
fs.writeFileSync(envPath, env.trim() + '\n', 'utf8');

console.log('✅ ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET generated and saved to .env');

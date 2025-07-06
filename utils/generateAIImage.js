// File: utils/generateAIImage.js
const { OpenAI } = require('openai');
const axios = require('axios');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function generateAIImage(text) {
    try {
        const prompt = `A visually stunning album cover for a music track titled "${text}". High quality, colorful, abstract or thematic background related to the song's tone.`;

        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: '1024x1024',
        });

        const imageUrl = response.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return Buffer.from(imageResponse.data, 'binary');

    } catch (err) {
        console.error('AI image generation failed:', err.message);
        throw new Error('AI image generation failed');
    }
};
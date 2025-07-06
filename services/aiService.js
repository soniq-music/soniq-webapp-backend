// Later you can connect this to real AI model
exports.detectMood = async (text) => {
    if (text.includes('happy')) return 'happy';
    if (text.includes('sad')) return 'sad';
    return 'neutral';
};

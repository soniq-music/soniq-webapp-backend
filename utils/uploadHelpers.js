// utils/uploadHelpers.js
const path = require('path');
const { uploadToCloudinaryStream } = require('./cloudinaryUpload');

exports.handleUploadIfNoUrl = async (file, url, folder, type) => {
    if (url && typeof url === 'string') return url;

    if (!file || !file.buffer) throw new Error(`Missing ${type} file`);

    if (type === 'audio' && !file.mimetype.startsWith('audio/')) {
        throw new Error('Invalid audio file type');
    }

    const publicId = `${type}-${Date.now()}-${path.parse(file.originalname).name}`;

    return await uploadToCloudinaryStream(file.buffer, {
        resource_type: type === 'audio' ? 'video' : 'image',
        folder,
        public_id: publicId
    });
};

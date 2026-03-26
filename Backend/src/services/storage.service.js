import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.config.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * StorageService handles all interactions with Cloudinary.
 * It provides a clean API for uploading single/multiple files
 * and deleting them, while enforcing consistent optimization settings.
 */
class StorageService {
    /**
     * Upload a single file to Cloudinary
     * @param {Object} file - The file object from multer (must have buffer)
     * @param {string} folder - The destination folder in Cloudinary
     * @param {Object} extraOptions - Additional Cloudinary options
     * @returns {Promise<{public_id: string, url: string}>}
     */
    async uploadSingle(file, folder = 'general', extraOptions = {}) {
        if (!file) return null;
        
        // Handle both multer single file (file) and field-based file (file[0])
        const fileToUpload = Array.isArray(file) ? file[0] : file;
        
        if (!fileToUpload || !fileToUpload.buffer) {
            return null;
        }

        const options = {
            folder: folder,
            resource_type: 'auto',
            quality: "auto",
            fetch_format: "auto",
            ...extraOptions
        };

        try {
            const result = await uploadToCloudinary(fileToUpload.buffer, options);
            return {
                public_id: result.public_id,
                url: result.secure_url
            };
        } catch (error) {
            throw new ApiError(500, `Cloudinary Upload Error: ${error.message}`);
        }
    }

    /**
     * Upload multiple files to Cloudinary
     * @param {Array} files - Array of multer file objects
     * @param {string} folder - The destination folder
     * @param {Object} extraOptions - Additional Cloudinary options
     * @returns {Promise<Array<{public_id: string, url: string}>>}
     */
    async uploadMultiple(files, folder = 'general', extraOptions = {}) {
        if (!files || !Array.isArray(files) || files.length === 0) {
            return [];
        }

        try {
            const uploadPromises = files.map(file => this.uploadSingle(file, folder, extraOptions));
            const results = await Promise.all(uploadPromises);
            return results.filter(res => res !== null);
        } catch (error) {
            throw new ApiError(500, `Cloudinary Bulk Upload Error: ${error.message}`);
        }
    }

    /**
     * Delete a file from Cloudinary
     * @param {string} public_id - The Cloudinary public_id
     */
    async deleteFile(public_id) {
        if (!public_id) return;
        try {
            await deleteFromCloudinary(public_id);
        } catch (error) {
            console.error(`Cloudinary Delete Error [${public_id}]:`, error.message);
            // We usually don't want to throw on delete failure to avoid blocking the main flow
        }
    }
}

export const storageService = new StorageService();

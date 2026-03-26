import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import {Readable} from 'stream';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      Readable.from(buffer).pipe(stream);
    });
};
    
export const deleteFromCloudinary = async (public_id) => {
    try {
        return await cloudinary.uploader.destroy(public_id);
    } catch (error) {
        throw error;
    }
};


export default cloudinary;
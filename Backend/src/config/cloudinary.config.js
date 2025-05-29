import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import {Readable} from 'stream';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to upload files to Cloudinary
export const uploadToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      });
  
      // Convert buffer to a readable stream and pipe to cloudinary
      const readable = new Readable();
      readable._read = () => {};
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  };
    

export const deleteFromCloudinary = async (public_id) => {
    try {
        const result = await cloudinary.uploader.destroy(public_id);
        return result;
    } catch (error) {
        // //('Error deleting from Cloudinary:', error);
        throw error;
    }
};


export default cloudinary;
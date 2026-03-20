import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './src/models/category.model.js';

dotenv.config();

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Create a category with isTriable: true
        const testCategory = new Category({
            name: 'Test Triable Category',
            slug: 'test-triable-category-' + Date.now(),
            level: 0,
            isTriable: true
        });

        const savedCategory = await testCategory.save();
        console.log('Saved category isTriable:', savedCategory.isTriable);

        if (savedCategory.isTriable === true) {
            console.log('✅ Verification Successful: isTriable field is working');
        } else {
            console.log('❌ Verification Failed: isTriable field not saved correctly');
        }

        // 2. Cleanup
        await Category.findByIdAndDelete(savedCategory._id);
        console.log('Test category deleted');

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    }
};

verify();

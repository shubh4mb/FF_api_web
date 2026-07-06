import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attribute from './src/models/attribute.model.js';
import Category from './src/models/category.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const fitValues = [
            'Regular', 'Slim', 'Relaxed', 'Oversized', 'Skinny', 
            'Straight', 'Loose', 'Tapered'
        ].map(val => ({ label: val, value: val.toLowerCase().replace(/\s+/g, '-') }));

        // 1. Create or find the Fit attribute
        let fitAttr = await Attribute.findOne({ slug: 'fit' });
        if (!fitAttr) {
            fitAttr = new Attribute({
                name: 'Fit',
                slug: 'fit',
                inputType: 'select',
                values: fitValues
            });
            await fitAttr.save();
            console.log('Created Fit attribute:', fitAttr._id);
        } else {
            console.log('Fit attribute already exists:', fitAttr._id);
            fitAttr.values = fitValues;
            await fitAttr.save();
        }

        // 2. Find categories
        const categoryNames = [
            'T-Shirt', 'Polo T-Shirt', 'Shirt', 'Top', 'Hoodie', 'Sweatshirt', 'Sweater', 
            'Jacket', 'Blazer', 'Cardigan', 'Jeans', 'Trousers', 'Pants', 'Shorts', 
            'Joggers', 'Track Pants', 'Leggings', 'Sports T-Shirt', 'Sports Shorts', 
            'Sports Jacket', 'Sports Hoodie', 'Tights', 'Boxers', 'Trunks', 'Lounge Wear', 
            'Sleep Shorts'
        ];

        // Regex for case insensitive match
        const categories = await Category.find({ 
            name: { $in: categoryNames.map(name => new RegExp(`^${name}$`, 'i')) } 
        });

        console.log(`Found ${categories.length} matching categories out of ${categoryNames.length}.`);

        let updatedCount = 0;
        for (const cat of categories) {
            const hasFit = cat.attributes.some(attr => attr.attribute.toString() === fitAttr._id.toString());
            if (!hasFit) {
                cat.attributes.push({
                    attribute: fitAttr._id,
                    isRequired: false,
                    isFilterable: true,
                    order: 0
                });
                await cat.save();
                updatedCount++;
                console.log(`Added Fit to category: ${cat.name}`);
            } else {
                console.log(`Fit already exists in category: ${cat.name}`);
            }
        }
        console.log(`Updated ${updatedCount} categories.`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

run();

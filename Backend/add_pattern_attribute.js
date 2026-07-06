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

        const patternValues = [
            'Solid', 'Printed', 'Graphic', 'Checked', 'Striped',
            'Floral', 'Embroidered', 'Self Design', 'Abstract',
            'Color Block', 'Tie Dye'
        ].map(val => ({ label: val, value: val.toLowerCase().replace(/\s+/g, '-') }));

        // 1. Create or find the Pattern attribute
        let patternAttr = await Attribute.findOne({ slug: 'pattern' });
        if (!patternAttr) {
            patternAttr = new Attribute({
                name: 'Pattern',
                slug: 'pattern',
                inputType: 'select',
                values: patternValues
            });
            await patternAttr.save();
            console.log('Created Pattern attribute:', patternAttr._id);
        } else {
            console.log('Pattern attribute already exists:', patternAttr._id);
            patternAttr.values = patternValues;
            await patternAttr.save();
        }

        // 2. Find categories
        const categoryNames = [
            'T-Shirt', 'Polo T-Shirt', 'Shirt', 'Top', 'Hoodie', 'Sweatshirt', 'Sweater',
            'Dress', 'Gown', 'Jumpsuit', 'Playsuit', 'Kurta', 'Kurti', 'Kurta Set',
            'Saree', 'Salwar Suit', 'Lehenga', 'Sports T-Shirt', 'Night Suit',
            'Night Dress', 'Pajama Set'
        ];

        // Regex for case insensitive match
        const categories = await Category.find({ 
            name: { $in: categoryNames.map(name => new RegExp(`^${name}$`, 'i')) } 
        });

        console.log(`Found ${categories.length} matching categories out of ${categoryNames.length}.`);

        let updatedCount = 0;
        for (const cat of categories) {
            const hasPattern = cat.attributes.some(attr => attr.attribute.toString() === patternAttr._id.toString());
            if (!hasPattern) {
                cat.attributes.push({
                    attribute: patternAttr._id,
                    isRequired: false,
                    isFilterable: true,
                    order: 0
                });
                await cat.save();
                updatedCount++;
                console.log(`Added Pattern to category: ${cat.name}`);
            } else {
                console.log(`Pattern already exists in category: ${cat.name}`);
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

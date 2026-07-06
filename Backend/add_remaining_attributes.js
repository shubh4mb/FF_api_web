import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attribute from './src/models/attribute.model.js';
import Category from './src/models/category.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const attributesData = [
    {
        name: 'Sleeve',
        slug: 'sleeve',
        inputType: 'select',
        values: ['Sleeveless', 'Half Sleeve', 'Three Quarter Sleeve', 'Full Sleeve'],
        categories: [
            'T-Shirt', 'Polo T-Shirt', 'Shirt', 'Top', 'Hoodie', 'Sweatshirt', 'Sweater',
            'Jacket', 'Blazer', 'Cardigan', 'Shrug', 'Dress', 'Gown', 'Jumpsuit',
            'Kurta', 'Kurti', 'Kurta Set', 'Salwar Suit', 'Sherwani', 'Sports T-Shirt',
            'Sports Jacket', 'Sports Hoodie', 'Night Suit', 'Night Dress'
        ]
    },
    {
        name: 'Neck Type',
        slug: 'neck-type',
        inputType: 'select',
        values: [
            'Round Neck', 'V Neck', 'Crew Neck', 'Boat Neck', 'Square Neck',
            'Scoop Neck', 'Sweetheart Neck', 'High Neck', 'Turtle Neck', 'Hooded'
        ],
        categories: [
            'T-Shirt', 'Top', 'Sweatshirt', 'Sweater', 'Hoodie', 'Dress', 'Gown',
            'Jumpsuit', 'Kurti', 'Salwar Suit', 'Sports T-Shirt', 'Vest', 'Night Dress'
        ]
    },
    {
        name: 'Collar Type',
        slug: 'collar-type',
        inputType: 'select',
        values: [
            'Shirt Collar', 'Polo Collar', 'Mandarin Collar', 'Band Collar',
            'Spread Collar', 'Notched Lapel'
        ],
        categories: [
            'Shirt', 'Polo T-Shirt', 'Kurta', 'Kurta Set', 'Sherwani', 'Jacket', 'Blazer'
        ]
    }
];

const run = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        for (const data of attributesData) {
            const formattedValues = data.values.map(val => ({
                label: val,
                value: val.toLowerCase().replace(/\s+/g, '-')
            }));

            // 1. Create or Find Attribute
            let attr = await Attribute.findOne({ slug: data.slug });
            if (!attr) {
                attr = new Attribute({
                    name: data.name,
                    slug: data.slug,
                    inputType: data.inputType,
                    values: formattedValues
                });
                await attr.save();
                console.log(`Created ${data.name} attribute: ${attr._id}`);
            } else {
                console.log(`${data.name} attribute already exists: ${attr._id}`);
                attr.values = formattedValues;
                await attr.save();
            }

            // 2. Map to Categories
            const categories = await Category.find({ 
                name: { $in: data.categories.map(name => new RegExp(`^${name}$`, 'i')) } 
            });

            console.log(`[${data.name}] Found ${categories.length} matching categories out of ${data.categories.length}.`);

            let updatedCount = 0;
            for (const cat of categories) {
                const hasAttr = cat.attributes.some(a => a.attribute.toString() === attr._id.toString());
                if (!hasAttr) {
                    cat.attributes.push({
                        attribute: attr._id,
                        isRequired: false,
                        isFilterable: true,
                        order: 0
                    });
                    await cat.save();
                    updatedCount++;
                    console.log(`  Added ${data.name} to category: ${cat.name}`);
                } else {
                    console.log(`  ${data.name} already exists in category: ${cat.name}`);
                }
            }
            console.log(`[${data.name}] Updated ${updatedCount} categories.`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

run();

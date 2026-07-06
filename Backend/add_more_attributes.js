import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attribute from './src/models/attribute.model.js';
import Category from './src/models/category.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const attributesData = [
    {
        name: 'Closure',
        slug: 'closure',
        inputType: 'select',
        values: ['Button', 'Zip', 'Drawstring', 'Elastic', 'Hook', 'Slip-On', 'Lace-Up', 'Buckle', 'Velcro'],
        categories: [
            'Shirt', 'Jacket', 'Hoodie', 'Blazer', 'Jeans', 'Trousers', 'Pants', 'Shorts',
            'Joggers', 'Track Pants', 'Skirts', 'Sneakers', 'Casual Shoes', 'Formal Shoes',
            'Sports Shoes', 'Sandals', 'Boots'
        ]
    },
    {
        name: 'Waist Rise',
        slug: 'waist-rise',
        inputType: 'select',
        values: ['Low Rise', 'Mid Rise', 'High Rise'],
        categories: [
            'Jeans', 'Trousers', 'Pants', 'Shorts', 'Joggers', 'Track Pants', 'Leggings', 'Capris', 'Skirts'
        ]
    },
    {
        name: 'Stretch',
        slug: 'stretch',
        inputType: 'select',
        values: ['Stretchable', 'Non Stretch'],
        categories: [
            'Jeans', 'Joggers', 'Leggings', 'Track Pants', 'Tights', 'Sports Shorts', 'Shapewear'
        ]
    },
    {
        name: 'Strap Type',
        slug: 'strap-type',
        inputType: 'select',
        values: ['Adjustable', 'Fixed', 'Cross Back', 'Racerback', 'Spaghetti', 'Halter'],
        categories: ['Bra', 'Camisole', 'Sports Bra']
    },
    {
        name: 'Padding',
        slug: 'padding',
        inputType: 'select',
        values: ['Padded', 'Non Padded', 'Removable Pads'],
        categories: ['Bra', 'Sports Bra']
    },
    {
        name: 'Support Level',
        slug: 'support-level',
        inputType: 'select',
        values: ['Light', 'Medium', 'High'],
        categories: ['Bra', 'Sports Bra']
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

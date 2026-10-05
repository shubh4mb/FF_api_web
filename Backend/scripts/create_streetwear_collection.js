import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Collection from '../src/models/collection.model.js';
import ProductFlat from '../src/models/productFlat.model.js';

dotenv.config();

async function createStreetwearCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // 1. Find streetwear-matching products
    const candidateProducts = await ProductFlat.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [
        { tags: { $in: ['streetwear', 'baggy', 'oversized', 'graphic jeans', 'retro', 'jersey', 'denim'] } },
        { name: { $regex: /oversized|baggy|streetwear|graphic|jersey|crewneck|hoodie/i } }
      ]
    }).lean();

    console.log(`Found ${candidateProducts.length} candidate product variants.`);
    const pinnedIds = candidateProducts.map(p => p._id);
    const styleGroups = [...new Set(candidateProducts.map(p => p.styleGroupId))];
    console.log(`Matching unique style groups: ${styleGroups.length}`);

    // 2. Find or create Collection
    let collection = await Collection.findOne({ slug: 'streetwear' });

    const collectionData = {
      name: 'Streetwear',
      slug: 'streetwear',
      tagline: 'Oversized, Baggy & Graphic Fits',
      description: 'Curated streetwear essentials featuring drop-shoulder tees, wide-leg denim, and statement silhouettes.',
      campaignType: 'curated',
      badgeText: '🔥 STREETWEAR DROP',
      bannerImage: {
        url: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=1200&q=80',
        public_id: 'streetwear_banner'
      },
      heroBannerImage: {
        url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80',
        public_id: 'streetwear_hero'
      },
      theme: {
        primaryColor: '#0F172A',
        secondaryColor: '#EF4444',
        bgGradientStart: '#0F172A',
        bgGradientEnd: '#1E293B',
        textColor: '#FFFFFF',
        presetName: 'midnight_luxe'
      },
      smartRules: {
        tags: ['streetwear', 'baggy', 'oversized', 'graphic jeans', 'retro', 'jersey', 'denim', 'casual'],
        keywords: ['oversized', 'baggy', 'streetwear', 'graphic', 'jersey', 'crewneck', 'shirt'],
        genders: ['MEN', 'WOMEN']
      },
      subCurations: [
        {
          id: 'all',
          label: 'All Streetwear',
          filterTag: '',
          gender: 'ALL'
        },
        {
          id: 'oversized',
          label: 'Oversized & Tees',
          filterTag: 'oversized',
          gender: 'ALL'
        },
        {
          id: 'baggy-denim',
          label: 'Baggy & Denim',
          filterTag: 'denim',
          gender: 'ALL'
        },
        {
          id: 'jerseys',
          label: 'Retro Jerseys',
          filterTag: 'jersey',
          gender: 'ALL'
        }
      ],
      pinnedProductIds: pinnedIds,
      priority: 100,
      isActive: true
    };

    if (!collection) {
      collection = new Collection(collectionData);
      await collection.save();
      console.log('Created new Collection "Streetwear":', collection._id);
    } else {
      Object.assign(collection, collectionData);
      await collection.save();
      console.log('Updated existing Collection "Streetwear":', collection._id);
    }

    // 3. Link this collection to all matching products and ensure "streetwear" tag is present
    const updateResult = await ProductFlat.updateMany(
      { _id: { $in: pinnedIds } },
      {
        $addToSet: {
          collectionIds: collection._id,
          tags: 'streetwear'
        }
      }
    );

    console.log(`Updated ${updateResult.modifiedCount} product variants with collectionId and 'streetwear' tag.`);

    // 4. Verify products linked
    const verifiedProducts = await ProductFlat.find({ collectionIds: collection._id })
      .select('name price tags styleGroupId')
      .lean();
    console.log(`\nVerification: Total products linked to collection "${collection.name}":`, verifiedProducts.length);
    const sampleNames = [...new Set(verifiedProducts.map(p => p.name))];
    console.log('Sample Linked Product Styles:');
    sampleNames.forEach(name => console.log(' •', name));

    process.exit(0);
  } catch (err) {
    console.error('Error creating streetwear collection:', err);
    process.exit(1);
  }
}

createStreetwearCollection();

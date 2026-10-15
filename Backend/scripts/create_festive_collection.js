import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Collection from '../src/models/collection.model.js';
import ProductFlat from '../src/models/productFlat.model.js';

dotenv.config();

async function createFestiveCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI.trim());
    console.log('Connected to DB');

    // 1. Find matching festive/floral/ethnic products
    const candidateProducts = await ProductFlat.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [
        { tags: { $in: ['ethnic', 'kurta set', 'dress', 'floral', 'maxi dress', 'festive', 'traditional', 'onam'] } },
        { name: { $regex: /dress|kurta|set|bloom|blossom|floral|embroidered|palazzo/i } }
      ]
    }).lean();

    console.log(`Found ${candidateProducts.length} candidate product variants.`);
    const pinnedIds = candidateProducts.map(p => p._id);
    const styleGroups = [...new Set(candidateProducts.map(p => p.styleGroupId))];
    console.log(`Matching unique style groups: ${styleGroups.length}`);

    // 2. Find or create Collection
    let collection = await Collection.findOne({ slug: 'festive-luxe' });

    const collectionData = {
      name: 'Festive Luxe',
      slug: 'festive-luxe',
      tagline: 'Handpicked Kurtas, Palazzos & Floral Dresses',
      description: 'Elevate your celebrations with elegant embroidered sets, flowing silhouettes, and timeless festive aesthetics.',
      campaignType: 'festival',
      badgeText: '✨ FESTIVE CURATION',
      bannerImage: {
        url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80',
        public_id: 'festive_banner'
      },
      heroBannerImage: {
        url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=80',
        public_id: 'festive_hero'
      },
      theme: {
        primaryColor: '#E11D48',
        secondaryColor: '#F59E0B',
        bgGradientStart: '#4C0519',
        bgGradientEnd: '#881337',
        textColor: '#FFFFFF',
        presetName: 'diwali_glow'
      },
      smartRules: {
        tags: ['ethnic', 'kurta set', 'dress', 'floral', 'maxi dress', 'festive', 'traditional'],
        keywords: ['dress', 'kurta', 'set', 'floral', 'embroidered', 'palazzo', 'bloom'],
        genders: ['WOMEN']
      },
      subCurations: [
        {
          id: 'all',
          label: 'All Festive',
          filterTag: '',
          gender: 'WOMEN'
        },
        {
          id: 'kurta-sets',
          label: 'Kurta & Palazzos',
          filterTag: 'kurta set',
          gender: 'WOMEN'
        },
        {
          id: 'floral-dresses',
          label: 'Floral Maxis',
          filterTag: 'dress',
          gender: 'WOMEN'
        },
        {
          id: 'budget-festive',
          label: 'Under ₹2499',
          filterTag: '',
          gender: 'WOMEN',
          maxPrice: 2499
        }
      ],
      pinnedProductIds: pinnedIds,
      priority: 90,
      isActive: true,
      attachedCouponCode: 'FESTIVE15'
    };

    if (!collection) {
      collection = new Collection(collectionData);
      await collection.save();
      console.log('Created new Collection "Festive Luxe":', collection._id);
    } else {
      Object.assign(collection, collectionData);
      await collection.save();
      console.log('Updated existing Collection "Festive Luxe":', collection._id);
    }

    // 3. Link this collection to all matching products and ensure "festive" tag is present
    const updateResult = await ProductFlat.updateMany(
      { _id: { $in: pinnedIds } },
      {
        $addToSet: {
          collectionIds: collection._id,
          tags: 'festive'
        }
      }
    );

    console.log(`Updated ${updateResult.modifiedCount} product variants with collectionId and 'festive' tag.`);

    // 4. Verify products linked
    const verifiedProducts = await ProductFlat.find({ collectionIds: collection._id })
      .select('name price tags styleGroupId')
      .lean();
    console.log(`\nVerification: Total products linked to collection "${collection.name}":`, verifiedProducts.length);
    const sampleNames = [...new Set(verifiedProducts.map(p => p.name))];
    console.log('Sample Linked Product Styles:');
    sampleNames.forEach(name => console.log(' •', name));

    // 5. Check all active collections in DB
    const allCollections = await Collection.find({ isActive: true }).select('name slug priority campaignType');
    console.log('\nAll Active Collections in DB:');
    allCollections.forEach(c => console.log(` • [Priority ${c.priority}] ${c.name} (${c.slug}) - ${c.campaignType}`));

    process.exit(0);
  } catch (err) {
    console.error('Error creating festive collection:', err);
    process.exit(1);
  }
}

createFestiveCollection();

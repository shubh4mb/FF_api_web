import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI.trim());
  const categories = await mongoose.connection.db.collection('categories').find({}).toArray();
  console.log('Categories count:', categories.length);
  console.log('Categories:', categories.slice(0, 10).map(c => ({ id: c._id, name: c.name, gender: c.gender })));
  
  const products = await mongoose.connection.db.collection('productflats').find({ isActive: true, isDeleted: { $ne: true } }).limit(25).toArray();
  console.log('Total products sample:', products.length);
  console.log('Sample Products:');
  products.forEach(p => console.log(` - ${p.name} (tags: ${p.tags?.join(', ') || 'none'}, gender: ${p.gender})`));
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

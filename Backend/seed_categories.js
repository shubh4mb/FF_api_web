import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "./src/models/category.model.js";

dotenv.config();

const categoriesData = [
  {
    name: "Topwear",
    isTriable: true,
    subcategories: [
      { name: "T-Shirt", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Polo T-Shirt", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Shirt", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Top", allowedGenders: ["WOMEN", "KIDS"] },
      { name: "Hoodie", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Sweatshirt", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Sweater", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Jacket", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Blazer", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Cardigan", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Shrug", allowedGenders: ["WOMEN"] }
    ]
  },
  {
    name: "Bottomwear",
    isTriable: true,
    subcategories: [
      { name: "Jeans", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Trousers", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Pants", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Shorts", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Joggers", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Track Pants", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Leggings", allowedGenders: ["WOMEN", "KIDS"] },
      { name: "Skirts", allowedGenders: ["WOMEN", "KIDS"] },
      { name: "Capris", allowedGenders: ["WOMEN"] }
    ]
  },
  {
    name: "Dresses",
    isTriable: true,
    subcategories: [
      { name: "Dress", allowedGenders: ["WOMEN", "KIDS"] },
      { name: "Gown", allowedGenders: ["WOMEN"] },
      { name: "Jumpsuit", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Playsuit", allowedGenders: ["WOMEN", "KIDS"] }
    ]
  },
  {
    name: "Ethnic Wear",
    isTriable: true,
    subcategories: [
      { name: "Kurta", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Kurti", allowedGenders: ["WOMEN"] },
      { name: "Kurta Set", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Saree", allowedGenders: ["WOMEN"] },
      { name: "Salwar Suit", allowedGenders: ["WOMEN"] },
      { name: "Lehenga", allowedGenders: ["WOMEN", "KIDS"] },
      { name: "Sherwani", allowedGenders: ["MEN"] },
      { name: "Dhoti", allowedGenders: ["MEN"] },
      { name: "Ethnic Bottoms", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Dupatta", allowedGenders: ["WOMEN"] }
    ]
  },
  {
    name: "Activewear",
    isTriable: true,
    subcategories: [
      { name: "Sports T-Shirt", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Sports Shorts", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Sports Jacket", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Sports Hoodie", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Track Pants", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Tights", allowedGenders: ["WOMEN"] },
      { name: "Sports Bra", allowedGenders: ["WOMEN"] }
    ]
  },
  {
    name: "Innerwear",
    isTriable: false,
    subcategories: [
      { name: "Bra", allowedGenders: ["WOMEN"] },
      { name: "Panties", allowedGenders: ["WOMEN"] },
      { name: "Briefs", allowedGenders: ["MEN"] },
      { name: "Boxers", allowedGenders: ["MEN"] },
      { name: "Trunks", allowedGenders: ["MEN"] },
      { name: "Vest", allowedGenders: ["MEN", "KIDS"] },
      { name: "Camisole", allowedGenders: ["WOMEN"] },
      { name: "Shapewear", allowedGenders: ["WOMEN"] },
      { name: "Thermal Innerwear", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Socks", allowedGenders: ["MEN", "WOMEN", "KIDS"] }
    ]
  },
  {
    name: "Sleepwear",
    isTriable: true,
    subcategories: [
      { name: "Night Suit", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Night Dress", allowedGenders: ["WOMEN", "KIDS"] },
      { name: "Pajama Set", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Lounge Wear", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Robe", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Sleep Shorts", allowedGenders: ["MEN", "WOMEN"] }
    ]
  },
  {
    name: "Footwear",
    isTriable: true,
    subcategories: [
      { name: "Sneakers", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Casual Shoes", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Formal Shoes", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Sports Shoes", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Sandals", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Slippers", allowedGenders: ["MEN", "WOMEN", "KIDS"] },
      { name: "Heels", allowedGenders: ["WOMEN"] },
      { name: "Flats", allowedGenders: ["WOMEN"] },
      { name: "Boots", allowedGenders: ["MEN", "WOMEN"] },
      { name: "Loafers", allowedGenders: ["MEN", "WOMEN"] }
    ]
  }
];

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/[^\w\-]+/g, "")       // Remove all non-word chars
    .replace(/\-\-+/g, "-");        // Replace multiple - with single -
};

const seedCategories = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in the environment variables.");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully to MongoDB.");

    // Delete existing categories
    console.log("Deleting existing categories...");
    const deleteResult = await Category.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing categories.`);

    // Insert new categories
    for (const parentData of categoriesData) {
      console.log(`Creating parent category: ${parentData.name}...`);
      
      // Calculate allowedGenders for parent category as union of all subcategory allowedGenders
      const unionGendersSet = new Set();
      parentData.subcategories.forEach(sub => {
        sub.allowedGenders.forEach(gender => unionGendersSet.add(gender));
      });
      const parentGenders = Array.from(unionGendersSet);

      const parentSlug = slugify(parentData.name);
      const parentCategory = new Category({
        name: parentData.name,
        slug: parentSlug,
        parentId: null,
        level: 0,
        allowedGenders: parentGenders,
        isTriable: parentData.isTriable,
        isActive: true,
        commissionPercentage: 0,
        ancestors: {}
      });

      const savedParent = await parentCategory.save();
      console.log(`✅ Parent category created: ${savedParent.name} (ID: ${savedParent._id}) - Genders: [${savedParent.allowedGenders.join(", ")}]`);

      // Insert subcategories
      for (const sub of parentData.subcategories) {
        const subSlug = `${parentSlug}-${slugify(sub.name)}`;
        const subCategory = new Category({
          name: sub.name,
          slug: subSlug,
          parentId: savedParent._id,
          level: 1,
          allowedGenders: sub.allowedGenders,
          isTriable: parentData.isTriable, // Inherit triability from parent
          isActive: true,
          commissionPercentage: 10,       // Standard default commission for subcategories
          ancestors: {
            parentName: savedParent.name
          }
        });

        const savedSub = await subCategory.save();
        console.log(`   - Created subcategory: ${savedSub.name} - Genders: [${savedSub.allowedGenders.join(", ")}]`);
      }
    }

    console.log("\n🎉 Category seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding categories:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

seedCategories();

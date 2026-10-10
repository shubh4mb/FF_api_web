import mongoose from 'mongoose';
import Category from '../models/category.model.js';

/**
 * Given an array of category/subcategory IDs, resolves and includes
 * their parent Category IDs as well (for level 1 subcategories).
 * This ensures queries for either parent (Level 0) or subcategory (Level 1)
 * will match the product.
 *
 * @param {Array<string|mongoose.Types.ObjectId>} categoryIds
 * @returns {Promise<Array<mongoose.Types.ObjectId>>}
 */
export const resolveCategoryHierarchy = async (categoryIds) => {
  if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
    return [];
  }

  const validIds = categoryIds
    .map(id => {
      if (!id) return null;
      if (typeof id === 'object' && id._id) return id._id.toString();
      return id.toString();
    })
    .filter(id => id && mongoose.Types.ObjectId.isValid(id));

  if (validIds.length === 0) return [];

  const foundCategories = await Category.find({ _id: { $in: validIds } })
    .select('_id parentId')
    .lean();

  const idSet = new Set(validIds);

  for (const cat of foundCategories) {
    if (cat.parentId) {
      idSet.add(cat.parentId.toString());
    }
  }

  return Array.from(idSet).map(id => new mongoose.Types.ObjectId(id));
};

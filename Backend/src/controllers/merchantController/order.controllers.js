import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";

export const saveProductDetails = async (req, res) => {
  try {
    const { name, description } = req.body;
    const productId = req.params.id;

    // Validate that at least one field is provided
    if (!name && !description) {
      return res.status(400).json({ 
        message: 'At least one of name or description is required' 
      });
    }

    // Validate name if provided
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({ 
        message: 'Product name cannot be empty' 
      });
    }

    // Build update object dynamically
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description;

    // Find and update product
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, isActive: true },
      updateFields,
      { new: true, runValidators: true }
    )
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .populate('merchantId', 'name');

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found or inactive' });
    }

    res.status(200).json({
      message: '✅ Product details updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

export const getOrderForMerchant = async (req, res) => {
  const orders = await Order.find({ merchantId: req.merchant.merchantId });
  return res.status(200).json({ orders });
};




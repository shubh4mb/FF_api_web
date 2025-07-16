import Product from '../../models/product.model.js';
import { uploadToCloudinary } from '../../config/cloudinary.config.js';


export const getBaseProducts = async (req, res) => {

  
  try {
    const products = await Product.find({})
      .populate('brandId', 'name') // Only get the 'name' field of the Brand
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('subSubCategoryId', 'name')
      .populate('merchantId', 'name');

    res.status(200).json({ products }); // wrap in { products } for consistency
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};


export const getVariants = async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json(products);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
      }
}

export const getBaseProductById = async (req, res) => {

  
    try {
        const product = await Product.findById(req.params.productId)
        .populate('brandId', 'name') // Only get the 'name' field of the Brand
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('subSubCategoryId', 'name')
        .populate('merchantId', 'name')
        
        res.status(200).json(product);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
      }
}

export const addVariant = async (req, res) => {
  try {
    console.log("Files received:", req.files);

    const productId = req.params.productId;
    const { color, sizes, mrp, price, discount } = req.body;

    // Parse JSON strings safely
    let parsedColor, parsedSizes;
    try {
      parsedColor = JSON.parse(color);
      parsedSizes = JSON.parse(sizes);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON in color or sizes' });
    }

    // Ensure numeric values are safe
    const safeNumber = (val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    const safeMrp = safeNumber(mrp);
    const safePrice = safeNumber(price);
    const safeDiscount = safeNumber(discount);

    // Upload images to Cloudinary (max 5)
    const MAX_IMAGES = 5;
    const uploadedImages = [];

    if (req.files && req.files.length > 0) {
      console.log(req.files);
      
      const filesToUpload = req.files.slice(0, MAX_IMAGES);
      for (const file of filesToUpload) {
        const result = await uploadToCloudinary(file.buffer, 'products');
        console.log("working");
        uploadedImages.push({
          public_id: result.public_id,
          url: result.secure_url,
        });
      }
    }

    // Construct the new variant object
    const newVariant = {
      color: parsedColor,
      sizes: parsedSizes,
      mrp: safeMrp,
      price: safePrice,
      discount: safeDiscount,
      images: uploadedImages,
    };

    // Update the product by pushing the variant
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $push: { variants: newVariant } },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(200).json({
      message: 'Variant added successfully',
      product: updatedProduct,
    });
  } catch (err) {
    console.error('Error adding variant:', err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: err.message,
    });
  }
};

export const getFilteredProducts = async (req, res) => {
    try {
        const products = await Product.find({
            categoryId: req.params.categoryId,
            subCategoryId: req.params.subCategoryId,
            subSubCategoryId: req.params.subSubCategoryId,
        })
        .populate('brandId', 'name') // Only get the 'name' field of the Brand
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('subSubCategoryId', 'name')
        .populate('merchantId', 'name')
        
        res.status(200).json(products);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
      }
}

    

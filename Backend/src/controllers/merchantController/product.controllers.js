import Product from '../../models/product.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';

export const addProduct = async (req, res) => {
    try {
      const { error, value } = productSchema.validate(req.body, { abortEarly: false });
  
      if (error) {
        return res.status(400).json({ message: "Validation failed", errors: error.details });
      }
      if(!req.files.images[0]){
        
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'image is required'
        });
      }
      let additionalImages =[]
      const uploadPromises = req.files.images.map(file =>
        uploadToCloudinary(file.buffer, {
            folder: 'products/variants',
            resource_type: 'auto'
        })
    );
    const results = await Promise.all(uploadPromises);
    additionalImages = results.map(result => ({
        public_id: result.public_id,
        url: result.secure_url
    }));
      const product = new Product(value);
      
      await product.save();
  
      res.status(201).json({ message: '✅ Product added successfully', product });
    } catch (error) {
      res.status(500).json({ message: '❌ ' + error.message });
    }
  };



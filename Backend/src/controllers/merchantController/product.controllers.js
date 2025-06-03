import Product from '../../models/product.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';

export const addProduct = async (req, res) => {
  console.log("hi");
  
    try {
      const { error, value } = productSchema.validate(req.body, { abortEarly: false });
  
      if (error) {
        console.log(error);
        
        return res.status(400).json({ message: "Validation failed", errors: error.details });
      }
      
        
       
      
      const product = new Product(value);
      
      await product.save();
  
      res.status(201).json({ message: '✅ Product added successfully', product });
    } catch (error) {
      console.log(error);
      
      res.status(500).json({ message: '❌ ' + error.message });
    }
  };



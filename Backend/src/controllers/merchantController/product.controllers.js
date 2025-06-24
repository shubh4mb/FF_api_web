import Product from '../../models/product.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';

export const addBaseProduct = async (req, res) => {
  console.log("hi");
  console.log(req.body);
  
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

export const addVariant = async (req, res) => {
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

   export const getBaseProducts = async (req, res) => {
    console.log("hi");
    
    try {
      const products = await Product.find({});
      res.status(200).json(products);
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
  };



import Category from '../../models/category.model.js';
import { uploadToCloudinary } from '../../config/cloudinary.config.js';

export const addCategory = async (req, res) => {
    console.log("yes reaching controller : ",req.body)
    console.log(req.file ,"image --")
    const image = req.file ? req.file.filename : null;
    let imageDetails = null;
    try {
      const { name, slug, parentId,level, gender, sortOrder,isActive } = req.body;
  
      if (parentId) {
        const parentCategory = await Category.findById(parentId);
        if (!parentCategory) {
          return res.status(400).json({ message: "Invalid parentId provided" });
        }
      
      }
      if (level == 2) {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Image is required for level 2 categories'
          });
        }
      
        try {
          const imageResult = await uploadToCloudinary(req.file.buffer, {
            folder: 'subsubCategory/image',
            resource_type: 'auto'
          });
      
          imageDetails = {
            public_id: imageResult.public_id,
            url: imageResult.secure_url
          };
        } catch (uploadError) {
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to Cloudinary',
            error: uploadError.message
          });
        }
      }
      
      const category = new Category({
        name,
        slug,
        parentId: parentId || null,
        level,
        gender,
        sortOrder,
        ...(imageDetails && { image: imageDetails })
      });
  
      await category.save();

      return res.status(201).json({
        success: true,
        message: 'Category added successfully',
        category
      });
    } catch (error) {
      res.status(500).json({ message: "❌ " + error.message });
    }
  };

export const updateCategory = async (req, res) => {
    try {
      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.status(200).json({ message: 'Category updated', updatedCategory });
    } catch (error) {
      res.status(500).json({ message: "❌ " + error.message });
    }
  };
  
export const getCategories = async (req, res) => {
  try {
    const categories = await Category
  .find({ isActive: true })
    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ message: "❌ " + error.message });
  }
};

export const getCategoryById=async(req,res)=>{
  try{
    console.log("yes reaching controller : ",req.params.id)
    const category = await Category.findById(req.params.id);
    res.status(200).json({ category });
  }catch(error){
    res.status(500).json({ message: "❌ " + error.message });
  }
}


  
  
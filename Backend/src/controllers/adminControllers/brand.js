import Brand from "../../models/brand.model.js";

export const addBrand=async(req,res)=>{
    console.log(req.body);
    
    try {
        const {name,description,logo,createdById,createdByType}=req.body;
        const brand=await Brand.create({name,description,logo,createdById,createdByType});
        res.status(201).json({brand});
    } catch (error) {
        res.status(500).json({error:error.message});
    }
}

export const getBrands=async(req,res)=>{
    try {
        const brands=await Brand.find({});
        res.status(200).json({brands});
    } catch (error) {
        res.status(500).json({error:error.message});
    }
}
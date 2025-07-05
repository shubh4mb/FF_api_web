import TitleBanner from "../../models/title_banners.model.js";  
import { uploadToCloudinary } from "../../config/cloudinary.config.js";

export const addTitleBanner=async(req,res)=>{
    console.log("hii");
    
    try{
        // console.log(req.body);
        // console.log(req.file);


        if (!req.body.title || !req.body.type) {
            return res.status(400).json({
              success: false,
              message: 'Title and type are required'
            });
          }

        if (!req.file) {
            return res.status(400).json({
              success: false,
              message: 'Image is required for title banner'
            });
          }

        if(req.file){
            const result=await uploadToCloudinary(req.file.buffer, {
                folder: 'subsubCategory/image',
                resource_type: 'auto'
              });
              req.body.image={
                public_id: result.public_id,
                url: result.secure_url
              };
        }
        
        const titleBanner=new TitleBanner();
        titleBanner.title=req.body.title;
        titleBanner.type=req.body.type;
        titleBanner.categoryId=req.body.categoryId;
        // titleBanner.isActive=req.body.isActive;
        titleBanner.image=req.body.image;
        await titleBanner.save();
        
        res.status(201).json({success:true,titleBanner});
    }
    catch(error){
        console.log(error);
        
        res.status(500).json({success:false,error:error.message});
    }
}
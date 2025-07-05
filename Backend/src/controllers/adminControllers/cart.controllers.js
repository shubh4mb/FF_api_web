import Cart from "../../models/cart.model.js";

export const addCart=async(req,res)=>{
    try{
        const cart=new Cart(req.body);
        await cart.save();
        res.status(201).json({success:true,cart});
    }
    catch(error){
        console.log(error);
        
        res.status(500).json({success:false,error:error.message});
    }
}

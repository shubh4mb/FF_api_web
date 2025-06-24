import Product from '../../models/product.model.js';

export const newArrivals = async (req, res) => {
    try {
        const products = await Product.find({isActive:true , createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) } });
        res.status(200).json(products);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
    }
}
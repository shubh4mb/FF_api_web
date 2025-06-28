import Product from '../../models/product.model.js';

export const newArrivals = async (req, res) => {
    try {
        const products = await Product.find({
            isActive: true,
            createdAt: {
                $gte: new Date(new Date().setDate(new Date().getDate() - 30))
            },
            variants: { $exists: true, $not: { $size: 0 } } // only products with variants
        });

        res.status(200).json(products);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
    }
}

export const productsDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id , {isActive:true})
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('subSubCategoryId', 'name')
        .populate('merchantId', 'name');
        res.status(200).json(product);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
    }
}

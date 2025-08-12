import { log } from "console";
import Cart from "../../models/cart.model.js";

export const addCart = async (req, res) => {
  

    try {
      const { productId, variantId, size, quantity, merchantId , image } = req.body;
    const cart = new Cart({
        items: [{ productId, variantId, size, quantity, merchantId , image }],
      });
  
      cart.updatedAt = new Date();
      await cart.save();
  
      res.status(201).json({ success: true, cart });
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const getCart = async (req, res) => {
  try {
    // Fetch all cart documents and populate product & merchant
    const carts = await Cart.find().populate("items.productId").populate("items.merchantId");
    const allItems = carts.flatMap(cart => cart.items);

    // console.log(carts,'cartscartscartscartscarts');
    

    res.status(200).json({
      success: true,
      totalCarts: carts.length,
      totalItems: allItems.length,
      items: allItems,
    });
  } catch (error) {
    console.error("Error fetching all cart items:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};





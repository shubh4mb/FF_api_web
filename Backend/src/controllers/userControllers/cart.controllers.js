import Cart from "../../models/cart.model.js";
import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import { log } from "console";



export const addToCart = async (req, res) => {
  const userId = req.user.userId; // from JWT middleware
  const { productId, variantId, size, quantity, merchantId, image } = req.body;

  if (!productId || !variantId || !size || !quantity || !merchantId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // 1. ✅ Validate product and stock
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = product.variants.id(variantId);
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    const sizeObj = variant.sizes.find(s => s.size === size);
    if (!sizeObj) return res.status(400).json({ message: "Invalid size selected" });

    if (sizeObj.stock < quantity) {
      return res.status(400).json({ message: `Only ${sizeObj.stock} items left in stock` });
    }

    // 2. ✅ Check if user already has a cart
    let cart = await Cart.findOne({ userId });

    // 3. 🧠 If no cart, create new
    if (!cart) {
      cart = new Cart({
        userId,
        items: [{
          productId,
          variantId,
          size,
          quantity,
          stockQuantity: sizeObj.stock,
          merchantId,
          image,
        }],
      });
    } else {
      // 4. 🔁 If cart exists, check if item already present
      const existingItem = cart.items.find(item =>
        item.productId.toString() === productId &&
        item.variantId.toString() === variantId &&
        item.size === size
      );

      if (existingItem) {
        // ➕ Update quantity
        if ((existingItem.quantity + quantity) > sizeObj.stock) {
          return res.status(400).json({ message: `Only ${sizeObj.stock} items left in stock` });
        }
        existingItem.quantity += quantity;
        existingItem.stockQuantity = sizeObj.stock; // Update stock info too if it might change
      } else {
        // ➕ Add new item
        cart.items.push({
          productId,
          variantId,
          size,
          quantity,
          stockQuantity: sizeObj.stock,
          merchantId,
          image,
        });
      }

      cart.updatedAt = new Date();
    }

    await cart.save();
    res.status(200).json({ message: "Item added to cart", cart });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


  export const getCart = async (req, res) => {
    const userId = req.user.userId;
    // console.log("hitting", userId);
  
    try {
      const cart = await Cart.findOne({ userId })
        .populate("items.productId")
        .populate("items.merchantId");
  
      if (!cart) {
        // If no cart found, return empty response
        return res.status(200).json({
          success: true,
          totalCarts: 0,
          totalItems: 0,
          items: [],
        });
      }
  
      res.status(200).json({
        success: true,
        totalCarts: 1,
        totalItems: cart.items.length,
        items: cart.items,
      });
    } catch (err) {
      console.error("Get cart error:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  export const clearCart = async (req, res) => {
  const userId = req.user.userId;
  console.log(userId,'logloglog');
  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Clear items array
    cart.items = [];
    await cart.save();

    res.status(200).json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


  


  

  

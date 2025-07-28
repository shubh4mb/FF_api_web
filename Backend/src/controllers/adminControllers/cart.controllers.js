import { log } from "console";
import Cart from "../../models/cart.model.js";

export const addCart = async (req, res) => {
  
  
  // console.log(req.body);

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

    // Flatten all items into a single array
    const allItems = carts.flatMap(cart => cart.items);

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

export const deleteCartItem = async (req, res) => {
  try {
    const { itemId } = req.params; // This is productId
    const { quantity, size } = req.query;

    console.log('Deleting cart item with:', { itemId, quantity, size });

    const updatedCart = await Cart.findOneAndUpdate(
      {
        "items.productId": itemId,
        "items.size": size,
        "items.quantity": parseInt(quantity)
      },
      {
        $pull: {
          items: {
            productId: itemId,
            size: size,
            quantity: parseInt(quantity)
          }
        }
      },
      { new: true }
    );

    if (!updatedCart) {
      return res.status(404).json({ success: false, message: "No matching item found in cart." });
    }

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      updatedCart
    });

  } catch (error) {
    console.error("Error deleting cart item:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// export const clearCart = async (req, res) => {
//   const userId = req.user.userId; // from JWT middleware
//   // console.log(userId,'userIduserIduserId');
  
//   console.log("Clearing cart for user:", userId);

//   try {
//     // Check if cart exists for the user
//     const cart = await Cart.findOne({ userId });

//     if (!cart) {
//       return res.status(404).json({ message: "Cart not found" });
//     }

//     // Clear all items
//     cart.items = [];
//     cart.updatedAt = new Date();

//     await cart.save();

//     res.status(200).json({ message: "Cart cleared successfully", cart });
//   } catch (err) {
//     console.error("Clear cart error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };



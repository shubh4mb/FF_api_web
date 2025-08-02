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

export const deleteCartItem = async (req, res) => {
  try {
    const { itemId } = req.params; // cart item id

    console.log(itemId,'itemIditemId');
    console.log('Deleting cart item with:', { itemId });

      const updatedCart = await Cart.findOneAndUpdate(
        { "items._id": itemId },      // Filter cart that contains that specific item _id
        {
          $pull: { items: { _id: itemId } } // Remove by item _id
        },
        { new: true }
      );

    if (!updatedCart) {
      return res.status(404).json({
        success: false,
        message: "No matching item found in cart.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      updatedCart,
    });

  } catch (error) {
    console.error("Error deleting cart item:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// export const updateCartQuantity = async (req, res) => {
//   try {
//     const userId = req.user.userId; // assuming authMiddleware sets this
//     const { cartId, quantity } = req.body;

//     console.log('Received data:', { userId, cartId, quantity });

//     if (!cartId || typeof quantity !== "number" || quantity < 1) {
//       return res.status(400).json({ success: false, message: 'Missing or invalid cartId or quantity' });
//     }

//     // Find the user's cart
//     const cart = await Cart.findOne({ userId });
//     if (!cart) {
//       return res.status(404).json({ success: false, message: 'Cart not found' });
//     }

//     // Find item by subdocument ID (cart.items._id)
//     const item = cart.items.id(cartId); // Mongoose shortcut

//     if (!item) {
//       return res.status(404).json({ success: false, message: 'Item not found in cart' });
//     }

//     // Update quantity
//     item.quantity = quantity;
//     await cart.save();

//     // Optionally, also return the updated cart total/value if needed for UI
//     return res.status(200).json({
//       success: true,
//       message: 'Quantity updated',
//       updatedItem: item
//     });
//   } catch (error) {
//     console.error('Error updating cart quantity:', error);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// };






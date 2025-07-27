import Cart from "../../models/cart.model.js";

export const addCart = async (req, res) => {
  
  
  console.log(req.body);

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
    const { itemId } = req.params; // This is the productId
    console.log('Deleting cart with productId in items:', itemId);

    // Find the cart that has a product with the given productId
    const cart = await Cart.findOne({ "items.productId": itemId });

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found with given productId" });
    }
    // Delete the whole cart document
    await Cart.findByIdAndDelete(cart._id);

    return res.status(200).json({ success: true, message: "Cart deleted successfully", deletedCartId: cart._id });
  } catch (error) {
    console.error("Error deleting cart:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};



import Cart from "../../models/cart.model.js";

export const addCart = async (req, res) => {
  
  console.log(req.body);
  

    try {
      const { productId, variantId, size, quantity, merchantId } = req.body;
  
    //   if (!userId || !productId || !variantId || !size || !quantity || !merchantId) {
    //     return res.status(400).json({ success: false, message: "All fields are required." });
    //   }
  
      // Check if cart already exists for the user
    //   let cart = await Cart.findOne({ userId });
  
    //   if (!cart) {
    //     // Create new cart with this item
    //     cart = new Cart({
    //       userId,
    //       items: [{ productId, variantId, size, quantity, merchantId }],
    //     });
    //   } else {
    //     // Check if item with same variant and size already exists in the cart
    //     const existingItem = cart.items.find(
    //       (item) =>
    //         item.variantId.toString() === variantId &&
    //         item.size === size &&
    //         item.merchantId.toString() === merchantId
    //     );
  
    //     if (existingItem) {
    //       // Update quantity
    //       existingItem.quantity += quantity;
    //     } else {
    //       // Add new item to cart
    //       cart.items.push({ productId, variantId, size, quantity, merchantId });
    //     }
    //   }

    const cart = new Cart({
        items: [{ productId, variantId, size, quantity, merchantId }],
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

import { log } from "console";
import Cart from "../../models/cart.model.js";
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export const addCart = asyncHandler(async (req, res) => {
  const { productId, variantId, size, quantity, merchantId, image } = req.body;
  const cart = new Cart({
    items: [{ productId, variantId, size, quantity, merchantId, image }],
  });

  cart.updatedAt = new Date();
  await cart.save();

  return res.status(201).json(new ApiResponse(201, { cart }, "Item added to cart successfully"));
});

export const getCart = asyncHandler(async (req, res) => {
  // Fetch all cart documents and populate product & merchant
  const carts = await Cart.find().populate("items.productId").populate("items.merchantId");
  const allItems = carts.flatMap(cart => cart.items);

  return res.status(200).json(new ApiResponse(200, {
    totalCarts: carts.length,
    totalItems: allItems.length,
    items: allItems,
  }, "Cart fetched successfully"));
});





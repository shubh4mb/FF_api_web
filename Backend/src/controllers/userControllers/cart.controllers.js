import Cart from "../../models/cart.model.js";
import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import { log } from "console";
import Address from '../../models/address.model.js'
import { calculateDeliveryCharge } from '../../helperFns/deliveryChargeFns.js'
import AppConfig from "../../models/appConfig.model.js";

export const addToCart = async (req, res) => {
  const userId = req.user.userId; // from JWT middleware
  const { productId, variantId, size, quantity, merchantId, image } = req.body;


  if (!productId || !variantId || !size || !quantity || !merchantId || !image) {
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


export const getCartCount = async (req, res) => {
  const userId = req.user.userId;

  try {
    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "variants")
      .lean();

    if (!cart) {
      return res.status(200).json({
        success: true,
        totalCarts: 0,
        totalItems: 0,
        items: [],
      });
    }

    const itemsWithVariant = cart.items.map((item) => {
      const product = item.productId;
      const variant = product?.variants?.find(
        (v) => v._id.toString() === item.variantId.toString()
      );

      return {
        ...item,
        price: variant?.price || null,
        mrp: variant?.mrp || null,
      };
    });

    res.status(200).json({
      success: true,
      totalCarts: 1,
      totalItems: itemsWithVariant.length,
      items: itemsWithVariant,
    });
  } catch (err) {
    console.error("Get cart count error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};




export const getCart = async (req, res) => {
  const userId = req.user.userId;
  const { addressId, serviceable, deliveryTip = 0 } = req.body;


  try {
    // 1️⃣ Fetch cart
    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "name variants")
      .populate("items.merchantId", "shopName address.location");

    if (!cart) {
      return res.status(200).json({
        success: true,
        totalItems: 0,
        items: [],
        deliveryDetails: null,
      });
    }

    // If no addressId provided, return just the cart items without delivery calculations
    if (!addressId && !serviceable) {
      const itemsWithVariant = cart.items.map((item) => {
        const product = item.productId;
        const variant = product?.variants?.find(
          (v) => v._id.toString() === item.variantId.toString()
        );

        return {
          ...item.toObject(),
          price: variant?.price || null,
          mrp: variant?.mrp || null,
          merchantDelivery: null, // No delivery info available
        };
      });

      return res.status(200).json({
        success: true,
        totalItems: itemsWithVariant.length,
        items: itemsWithVariant,
        deliveryDetails: null,
        address: null,
        serviceable
      });
    }

    // 2️⃣ Fetch delivery address (only if addressId is provided)
    const selectedAddress = await Address.findById(addressId);
    if (!selectedAddress) {
      console.log("Selected address not found");
      return res.status(400).json({
        success: false,
        message: "Selected address not found",
      });
    }

    const userLat = selectedAddress.location.coordinates[1];
    const userLng = selectedAddress.location.coordinates[0];

    // 2.5️⃣ Fetch App Config for rates
    const config = await AppConfig.getConfig();

    // 3️⃣ Build items with variant price + merchant delivery charge
    let merchantDeliveryMap = {};
    let subtotal = 0;
    let mrpTotal = 0;

    const itemsWithVariant = cart.items.map((item) => {
      const product = item.productId;
      const merchant = item.merchantId;

      const variant = product?.variants?.find(
        (v) => v._id.toString() === item.variantId.toString()
      );

      const price = variant?.price || 0;
      const mrp = variant?.mrp || 0;
      subtotal += price * item.quantity;
      mrpTotal += mrp * item.quantity;

      if (!merchantDeliveryMap[merchant._id]) {
        const userCoords = [userLng, userLat];
        const merchantCoords = [merchant.address.location.coordinates[0], merchant.address.location.coordinates[1]];

        const { distanceKm, deliveryCharge, returnCharge } = calculateDeliveryCharge({
          userCoords,
          merchantCoords,
          deliveryPerKmRate: config.deliveryPerKmRate,
          returnPerKmRate: config.returnPerKmRate,
          waitingCharge: config.waitingCharge
        });

        merchantDeliveryMap[merchant._id] = {
          merchantId: merchant._id,
          shopName: merchant.shopName,
          distanceKm,
          deliveryCharge,
          returnCharge,
        };
      }

      return {
        ...item.toObject(),
        price,
        mrp,
        merchantDelivery: merchantDeliveryMap[merchant._id],
      };
    });

    // 3.5️⃣ Calculate Aggregate Totals
    let totalDeliveryCharge = 0;
    let totalReturnCharge = 0;
    Object.values(merchantDeliveryMap).forEach(d => {
      totalDeliveryCharge += d.deliveryCharge;
      totalReturnCharge += d.returnCharge;
    });

    const tip = Number(deliveryTip) || 0;
    const serviceGST = parseFloat(((totalDeliveryCharge + tip) * 0.18).toFixed(2));
    const totalUpfrontPayable = totalDeliveryCharge + totalReturnCharge + tip + serviceGST;

    const totals = {
      subtotal,
      mrpTotal,
      discount: mrpTotal - subtotal,
      totalDeliveryCharge,
      totalReturnCharge,
      deliveryTip: tip,
      serviceGST,
      totalUpfrontPayable,
      finalTotal: subtotal + totalUpfrontPayable
    };

    // 4️⃣ Response
    res.status(200).json({
      success: true,
      totalItems: itemsWithVariant.length,
      items: itemsWithVariant,
      deliveryDetails: Object.values(merchantDeliveryMap),
      totals,
      address: selectedAddress,
      serviceable
    });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export const clearCart = async (req, res) => {
  const userId = req.user.userId;
  // console.log(userId,'logloglog');
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

export const deleteCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;



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

export const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.user.userId; // assuming authMiddleware sets this
    const { cartId, quantity } = req.body;




    if (!cartId || typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Missing or invalid cartId or quantity' });
    }

    // Find the user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Find item by subdocument ID (cart.items._id)
    const item = cart.items.id(cartId); // Mongoose shortcut

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    // Update quantity
    item.quantity = quantity;
    await cart.save();

    // Optionally, also return the updated cart total/value if needed for UI
    return res.status(200).json({
      success: true,
      message: 'Quantity updated',
      updatedItem: item
    });
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};












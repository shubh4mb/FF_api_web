import Cart from "../../models/cart.model.js";
import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import { log } from "console";
import Address from '../../models/address.model.js'
import { calculateDeliveryCharge } from '../../helperFns/deliveryChargeFns.js'
import AppConfig from "../../models/appConfig.model.js";
import CourierCart from "../../models/courierCart.model.js";
import { findBestOffers } from '../../services/offerEngine.js';

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
          image: typeof image === 'string' ? { url: image } : image,
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
          image: typeof image === 'string' ? { url: image } : image,
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
      .populate("items.productId", "name variants images")
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
  const { addressId, latitude, longitude, serviceable, deliveryTip = 0 } = req.body;

  try {
    // 1️⃣ Fetch cart
    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "name variants images")
      .populate("items.merchantId", "shopName address"); // Fetch full address object

    if (!cart) {
      return res.status(200).json({
        success: true,
        totalItems: 0,
        items: [],
        deliveryDetails: null,
      });
    }

    // 2.5️⃣ Fetch App Config for rates
    const config = await AppConfig.getConfig();

    // 2️⃣ Fetch delivery address (conditional)
    let selectedAddress = null;
    if (addressId) {
      selectedAddress = await Address.findById(addressId).lean();
    }

    // Fallback: If no address found by ID, but coordinates provided, create a virtual one
    if (!selectedAddress && latitude !== undefined && longitude !== undefined) {
      selectedAddress = {
        _id: "temporary",
        addressType: "Current Location",
        location: {
          type: "Point",
          coordinates: [Number(longitude), Number(latitude)]
        },
        latitude: Number(latitude),
        longitude: Number(longitude)
      };
    }

    // 3️⃣ Build items and calculate delivery per merchant
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

      // Delivery calculation logic
      let deliveryInfo = null;
      if (selectedAddress && merchant && merchant.address) {
        const merchantKey = merchant._id.toString();
        if (!merchantDeliveryMap[merchantKey]) {
          // Robust coordinate extraction for User
          let userCoords = selectedAddress.location?.coordinates;
          if (!userCoords || userCoords.length < 2) {
            if (selectedAddress.longitude !== undefined && selectedAddress.latitude !== undefined) {
              userCoords = [selectedAddress.longitude, selectedAddress.latitude];
            }
          }

          // Robust coordinate extraction for Merchant
          let merchantCoords = merchant.address?.location?.coordinates;
          if (!merchantCoords || merchantCoords.length < 2) {
            if (merchant.address?.longitude !== undefined && merchant.address?.latitude !== undefined) {
              merchantCoords = [merchant.address.longitude, merchant.address.latitude];
            }
          }

          if (userCoords && merchantCoords && userCoords.length >= 2 && merchantCoords.length >= 2) {
            const { distanceKm, deliveryCharge, returnCharge } = calculateDeliveryCharge({
              userCoords,
              merchantCoords,
              deliveryPerKmRate: config.deliveryPerKmRate,
              returnPerKmRate: config.returnPerKmRate,
              waitingCharge: config.waitingCharge
            });

            const TRY_BUY_RADIUS = config.deliveryRadius || 7;
            const isEligibleForTryBuy = distanceKm <= TRY_BUY_RADIUS;

            merchantDeliveryMap[merchantKey] = {
              merchantId: merchant._id,
              shopName: merchant.shopName,
              distanceKm,
              deliveryCharge,
              returnCharge,
              isEligibleForTryBuy,
              message: isEligibleForTryBuy ? null : `Merchant is beyond ${TRY_BUY_RADIUS}km for Try & Buy`
            };
          }
        }
        deliveryInfo = merchantDeliveryMap[merchantKey] || null;
      }

      return {
        ...item.toObject(),
        price,
        mrp,
        merchantDelivery: deliveryInfo,
      };
    });

    // 3.5️⃣ Calculate Aggregate Totals
    let totalDeliveryCharge = 0;
    let totalReturnCharge = 0;
    Object.values(merchantDeliveryMap).forEach(d => {
      totalDeliveryCharge += d.deliveryCharge || 0;
      totalReturnCharge += d.returnCharge || 0;
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

    // 3.6 ── Compute best offers ──
    let appliedOffers = { adminOffer: null, merchantOffer: null, totalDiscount: 0, freeDelivery: false };
    try {
      const merchantIds = Object.keys(merchantDeliveryMap);
      const merchantTotals = {};
      for (const item of itemsWithVariant) {
        const mid = item.merchantId?._id?.toString() || item.merchantId?.toString() || 'unknown';
        merchantTotals[mid] = (merchantTotals[mid] || 0) + (item.price * (item.quantity || 1));
      }

      appliedOffers = await findBestOffers(
        userId,
        { 
          items: itemsWithVariant, 
          subtotal, 
          merchantTotals,
          totalDeliveryCharge,
          totalReturnCharge 
        }
      );
      
      // If freeDelivery applies, waive delivery & return charges
      if (appliedOffers && appliedOffers.freeDelivery) {
        totals.totalDeliveryCharge = 0;
        totals.totalReturnCharge = 0;
        
        // Recalculate GST and upfront payable
        const tip = Number(deliveryTip) || 0;
        totals.serviceGST = parseFloat(((totals.totalDeliveryCharge + tip) * 0.18).toFixed(2));
        totals.totalUpfrontPayable = totals.totalDeliveryCharge + totals.totalReturnCharge + tip + totals.serviceGST;
        totals.finalTotal = subtotal - appliedOffers.totalDiscount + totals.totalUpfrontPayable;
      } else {
        totals.finalTotal = subtotal - appliedOffers.totalDiscount + totals.totalUpfrontPayable;
      }
      totals.discount = (mrpTotal - subtotal) + (appliedOffers.totalDiscount || 0);

    } catch (offerErr) {
      console.error('Offer engine error (non-blocking):', offerErr.message);
    }

    // 4️⃣ Response
    return res.status(200).json({
      success: true,
      totalItems: itemsWithVariant.length,
      items: itemsWithVariant,
      deliveryDetails: Object.values(merchantDeliveryMap).length > 0 ? Object.values(merchantDeliveryMap) : null,
      totals,
      appliedOffers,
      address: selectedAddress,
      serviceable: !!(selectedAddress && serviceable),
    });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ success: false, message: "Server error" });
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

export const moveToCourier = async (req, res) => {
  const userId = req.user.userId;
  const { merchantId, itemId } = req.body;

  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    let itemsToMove = [];
    if (merchantId) {
      itemsToMove = cart.items.filter(item => item.merchantId.toString() === merchantId);
      cart.items = cart.items.filter(item => item.merchantId.toString() !== merchantId);
    } else if (itemId) {
      const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
      if (itemIndex > -1) {
        itemsToMove = [cart.items[itemIndex]];
        cart.items.splice(itemIndex, 1);
      }
    }

    if (itemsToMove.length === 0) {
      return res.status(404).json({ success: false, message: "No items found to move" });
    }

    let courierCart = await CourierCart.findOne({ userId });
    if (!courierCart) {
      courierCart = new CourierCart({ userId, items: [] });
    }

    for (const item of itemsToMove) {
      const existingItem = courierCart.items.find(ci => 
        ci.productId.toString() === item.productId.toString() &&
        ci.variantId.toString() === item.variantId.toString() &&
        ci.size === item.size
      );

      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        courierCart.items.push({
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          quantity: item.quantity,
          merchantId: item.merchantId,
          image: item.image,
          stockQuantity: item.stockQuantity
        });
      }
    }

    await cart.save();
    await courierCart.save();

    res.status(200).json({ success: true, message: "Items moved to courier cart" });
  } catch (error) {
    console.error("Move to courier error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};












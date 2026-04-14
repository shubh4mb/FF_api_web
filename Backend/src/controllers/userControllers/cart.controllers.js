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

    // Count unique merchants
    const merchantSet = new Set(cart.items.map(i => i.merchantId?.toString()));

    res.status(200).json({
      success: true,
      totalCarts: merchantSet.size,
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
      .populate({
        path: "items.productId",
        select: "name variants images categoryId subCategoryId brandId gender tags collectionIds",
      })
      .populate("items.merchantId", "shopName address isOnline logo");

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        totalItems: 0,
        merchantCarts: [],
        // Legacy flat fields for backward compat
        items: [],
        deliveryDetails: null,
      });
    }

    // 2️⃣ Fetch App Config for rates
    const config = await AppConfig.getConfig();

    // 3️⃣ Fetch delivery address (conditional)
    let selectedAddress = null;
    if (addressId) {
      selectedAddress = await Address.findById(addressId).lean();
    }
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

    // 4️⃣ Enrich items with price/variant info and group by merchant
    const merchantGroupMap = {}; // merchantId -> { merchant, items[] }

    for (const item of cart.items) {
      const product = item.productId;
      const merchant = item.merchantId;
      const merchantKey = merchant?._id?.toString() || item.merchantId?.toString() || 'unknown';

      const variant = product?.variants?.find(
        (v) => v._id.toString() === item.variantId.toString()
      );
      const price = variant?.price || 0;
      const mrp = variant?.mrp || 0;

      if (!merchantGroupMap[merchantKey]) {
        merchantGroupMap[merchantKey] = {
          merchant,
          items: [],
        };
      }

      merchantGroupMap[merchantKey].items.push({
        ...item.toObject(),
        price,
        mrp,
      });
    }

    // 5️⃣ Build per-merchant carts with delivery + totals + offers
    const merchantCarts = [];
    let globalTotalItems = 0;
    // Also build legacy flat arrays for backward compat
    const allItems = [];
    const allDeliveryDetails = [];

    for (const [merchantKey, group] of Object.entries(merchantGroupMap)) {
      const { merchant, items } = group;
      globalTotalItems += items.length;

      // --- Delivery calculation for this merchant ---
      let deliveryInfo = null;
      if (selectedAddress && merchant && merchant.address) {
        let userCoords = selectedAddress.location?.coordinates;
        if (!userCoords || userCoords.length < 2) {
          if (selectedAddress.longitude !== undefined && selectedAddress.latitude !== undefined) {
            userCoords = [selectedAddress.longitude, selectedAddress.latitude];
          }
        }
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
          deliveryInfo = {
            merchantId: merchant._id,
            shopName: merchant.shopName,
            distanceKm,
            deliveryCharge,
            returnCharge,
            isEligibleForTryBuy,
            message: isEligibleForTryBuy ? null : `Merchant is beyond ${TRY_BUY_RADIUS}km for Try & Buy`
          };
          allDeliveryDetails.push(deliveryInfo);
        }
      }

      // Attach delivery info to each item
      const enrichedItems = items.map(item => ({
        ...item,
        merchantDelivery: deliveryInfo,
      }));
      allItems.push(...enrichedItems);

      // --- Per-merchant totals ---
      let mSubtotal = 0;
      let mMrpTotal = 0;
      for (const item of items) {
        mSubtotal += item.price * item.quantity;
        mMrpTotal += item.mrp * item.quantity;
      }

      const mDeliveryCharge = deliveryInfo?.deliveryCharge || 0;
      const mReturnCharge = deliveryInfo?.returnCharge || 0;
      const tip = Number(deliveryTip) || 0;
      const mServiceGST = parseFloat(((mDeliveryCharge + tip) * 0.18).toFixed(2));
      const mUpfrontPayable = mDeliveryCharge + mReturnCharge + tip + mServiceGST;

      const mTotals = {
        subtotal: mSubtotal,
        mrpTotal: mMrpTotal,
        discount: mMrpTotal - mSubtotal,
        totalDeliveryCharge: mDeliveryCharge,
        totalReturnCharge: mReturnCharge,
        deliveryTip: tip,
        serviceGST: mServiceGST,
        totalUpfrontPayable: mUpfrontPayable,
        finalTotal: mSubtotal + mUpfrontPayable,
      };

      // --- Per-merchant offers ---
      let mAppliedOffers = { appliedOffers: [], totalDiscount: 0, freeDelivery: false };
      try {
        const merchantTotals = {};
        merchantTotals[merchantKey] = mSubtotal;
        mAppliedOffers = await findBestOffers(
          userId,
          {
            items: enrichedItems,
            subtotal: mSubtotal,
            merchantTotals,
            totalDeliveryCharge: mDeliveryCharge,
            totalReturnCharge: mReturnCharge,
          }
        );
        if (mAppliedOffers && mAppliedOffers.freeDelivery) {
          mTotals.totalDeliveryCharge = 0;
          mTotals.totalReturnCharge = 0;
          mTotals.serviceGST = parseFloat(((0 + tip) * 0.18).toFixed(2));
          mTotals.totalUpfrontPayable = 0 + 0 + tip + mTotals.serviceGST;
          mTotals.finalTotal = mSubtotal - mAppliedOffers.totalDiscount + mTotals.totalUpfrontPayable;
        } else {
          mTotals.finalTotal = mSubtotal - (mAppliedOffers.totalDiscount || 0) + mTotals.totalUpfrontPayable;
        }
        mTotals.discount = (mMrpTotal - mSubtotal) + (mAppliedOffers.totalDiscount || 0);
      } catch (offerErr) {
        console.error('Offer engine error (non-blocking):', offerErr.message);
      }

      merchantCarts.push({
        merchantId: merchantKey,
        merchantDetails: {
          _id: merchant?._id,
          shopName: merchant?.shopName,
          isOnline: merchant?.isOnline,
          logo: merchant?.logo,
        },
        items: enrichedItems,
        deliveryDetails: deliveryInfo,
        totals: mTotals,
        appliedOffers: mAppliedOffers,
      });
    }

    // 6️⃣ Response — includes new merchantCarts array plus legacy flat fields
    return res.status(200).json({
      success: true,
      totalItems: globalTotalItems,
      merchantCarts,
      // Legacy flat fields (kept for backward compat with header badge etc)
      items: allItems,
      deliveryDetails: allDeliveryDetails.length > 0 ? allDeliveryDetails : null,
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












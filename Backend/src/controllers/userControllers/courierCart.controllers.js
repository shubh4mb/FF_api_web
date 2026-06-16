import CourierCart from "../../models/courierCart.model.js";
import Product from "../../models/product.model.js";
import { findBestOffers } from '../../services/offerEngine.js';
import Offer from "../../models/offer.model.js";

/**
 * Add item to Courier Cart
 */
export const addToCourierCart = async (req, res) => {
  const userId = req.user.userId;
  const { productId, variantId, size, quantity, merchantId, image } = req.body;

  if (!productId || !variantId || !size || !quantity || !merchantId || !image) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = product.variants.id(variantId);
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    const sizeObj = variant.sizes.find(s => s.size === size);
    if (!sizeObj) return res.status(400).json({ message: "Invalid size selected" });

    if (sizeObj.stock < quantity) {
      return res.status(400).json({ message: `Only ${sizeObj.stock} items left in stock` });
    }

    let cart = await CourierCart.findOne({ userId });

    if (!cart) {
      cart = new CourierCart({
        userId,
        items: [{ productId, variantId, size, quantity, stockQuantity: sizeObj.stock, merchantId, image: typeof image === 'string' ? { url: image } : image }],
      });
    } else {
      const existingItem = cart.items.find(item =>
        item.productId.toString() === productId &&
        item.variantId.toString() === variantId &&
        item.size === size
      );

      if (existingItem) {
        if ((existingItem.quantity + quantity) > sizeObj.stock) {
          return res.status(400).json({ message: `Only ${sizeObj.stock} items left in stock` });
        }
        existingItem.quantity += quantity;
        existingItem.stockQuantity = sizeObj.stock;
      } else {
        cart.items.push({ productId, variantId, size, quantity, stockQuantity: sizeObj.stock, merchantId, image: typeof image === 'string' ? { url: image } : image });
      }
      cart.updatedAt = new Date();
    }

    await cart.save();
    res.status(200).json({ success: true, message: "Item added to courier cart", cart });
  } catch (err) {
    console.error("Add to courier cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get Courier Cart (with product details)
 */
export const getCourierCart = async (req, res) => {
  const userId = req.user.userId;

  try {
    const cart = await CourierCart.findOne({ userId })
      .populate("items.productId", "name variants images")
      .populate("items.merchantId", "shopName address enableCourierDelivery isOnline");

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        totalItems: 0,
        items: [],
        courierDeliveryCharge: 40,
      });
    }

    let subtotal = 0;
    let mrpTotal = 0;

    const itemsWithDetails = cart.items.map(item => {
      const product = item.productId;
      const variant = product?.variants?.find(
        v => v._id.toString() === item.variantId.toString()
      );

      const price = variant?.price || 0;
      const mrp = variant?.mrp || 0;
      subtotal += price * item.quantity;
      mrpTotal += mrp * item.quantity;

      return {
        ...item.toObject(),
        price,
        mrp,
      };
    });

    const merchantTotals = {};
    itemsWithDetails.forEach(item => {
      const mKey = item.merchantId?._id?.toString() || item.merchantId?.toString();
      if(mKey) merchantTotals[mKey] = (merchantTotals[mKey] || 0) + (item.price * item.quantity);
    });
    const courierDeliveryCharge = 40;

    let mAppliedOffers = { appliedOffers: [], availableOffers: [], totalDiscount: 0, freeDelivery: false };
    try {
      mAppliedOffers = await findBestOffers(
        userId,
        {
          items: itemsWithDetails,
          subtotal,
          merchantTotals,
          totalDeliveryCharge: courierDeliveryCharge,
          totalReturnCharge: 0,
        },
        cart.couponCode,
        cart.selectedOffers,
        'courier'
      );
    } catch (e) {
      console.error('Offer engine error in courier cart:', e.message);
    }

    const finalDeliveryCharge = mAppliedOffers.freeDelivery ? 0 : courierDeliveryCharge;

    const serviceGST = 0;

    const totals = {
      subtotal,
      mrpTotal,
      discount: Math.round((mrpTotal - subtotal) + (mAppliedOffers.totalDiscount || 0)),
      courierDeliveryCharge: finalDeliveryCharge,
      serviceGST,
      totalPayable: Math.round(subtotal - (mAppliedOffers.totalDiscount || 0) + finalDeliveryCharge),
    };

    res.status(200).json({
      success: true,
      totalItems: itemsWithDetails.length,
      items: itemsWithDetails,
      totals,
      appliedOffers: mAppliedOffers,
    });
  } catch (err) {
    console.error("Get courier cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update courier cart item quantity
 */
export const updateCourierCartQuantity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartId, quantity } = req.body;

    if (!cartId || typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ success: false, message: "Missing or invalid cartId or quantity" });
    }

    const cart = await CourierCart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.id(cartId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found in cart" });

    item.quantity = quantity;
    await cart.save();

    return res.status(200).json({ success: true, message: "Quantity updated", updatedItem: item });
  } catch (error) {
    console.error("Error updating courier cart quantity:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Delete item from courier cart
 */
export const deleteCourierCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const updatedCart = await CourierCart.findOneAndUpdate(
      { "items._id": itemId },
      { $pull: { items: { _id: itemId } } },
      { new: true }
    );

    if (!updatedCart) {
      return res.status(404).json({ success: false, message: "No matching item found in courier cart." });
    }

    return res.status(200).json({ success: true, message: "Item removed from courier cart", updatedCart });
  } catch (error) {
    console.error("Error deleting courier cart item:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Clear courier cart
 */
export const clearCourierCart = async (req, res) => {
  const userId = req.user.userId;
  try {
    const cart = await CourierCart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = [];
    await cart.save();

    res.status(200).json({ success: true, message: "Courier cart cleared" });
  } catch (error) {
    console.error("Error clearing courier cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get courier cart item count
 */
export const getCourierCartCount = async (req, res) => {
  const userId = req.user.userId;
  try {
    const cart = await CourierCart.findOne({ userId })
      .populate("items.productId", "name variants images")
      .lean();

    if (!cart) {
      return res.status(200).json({ success: true, totalItems: 0, items: [] });
    }

    const itemsWithVariant = cart.items.map(item => {
      const product = item.productId;
      const variant = product?.variants?.find(
        v => v._id.toString() === item.variantId.toString()
      );
      return {
        ...item,
        price: variant?.price || null,
        mrp: variant?.mrp || null,
      };
    });

    res.status(200).json({
      success: true,
      totalItems: itemsWithVariant.length,
      items: itemsWithVariant,
    });
  } catch (err) {
    console.error("Get courier cart count error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Manual Offer Selection ---

export const selectOfferCourier = async (req, res) => {
  const userId = req.user.userId;
  const { offerId, targetItemIds } = req.body;

  if (!offerId) {
    return res.status(400).json({ success: false, message: 'offerId is required' });
  }

  try {
    const cart = await CourierCart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    // Clear coupon and enforce single selected offer
    cart.couponCode = null;
    cart.selectedOffers = [{ offerId, targetItemIds: targetItemIds || [] }];
    
    await cart.save();

    res.status(200).json({ success: true, message: 'Offer selected', selectedOffers: cart.selectedOffers });
  } catch (error) {
    console.error("Select offer error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deselectOfferCourier = async (req, res) => {
  const userId = req.user.userId;
  const { offerId } = req.body;

  if (!offerId) {
    return res.status(400).json({ success: false, message: 'offerId is required' });
  }

  try {
    const cart = await CourierCart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.selectedOffers = cart.selectedOffers.filter(o => o.offerId.toString() !== offerId.toString());

    // Also clear couponCode if this is the active coupon offer
    const offer = await Offer.findById(offerId);
    if (offer && offer.requiresCoupon && cart.couponCode && cart.couponCode.toUpperCase() === offer.couponCode.toUpperCase()) {
      cart.couponCode = null;
    }

    await cart.save();

    res.status(200).json({ success: true, message: 'Offer deselected', selectedOffers: cart.selectedOffers });
  } catch (error) {
    console.error("Deselect offer error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

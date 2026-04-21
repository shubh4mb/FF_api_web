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

    let cart = await Cart.findOne({ userId });

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
        items: [],
        deliveryDetails: null,
      });
    }

    const config = await AppConfig.getConfig();
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

    const merchantGroupMap = {};
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
        merchantGroupMap[merchantKey] = { merchant, items: [] };
      }
      merchantGroupMap[merchantKey].items.push({ ...item.toObject(), price, mrp });
    }

    const merchantCarts = [];
    let globalTotalItems = 0;
    const allItems = [];
    const allDeliveryDetails = [];

    for (const [merchantKey, group] of Object.entries(merchantGroupMap)) {
      const { merchant, items } = group;
      globalTotalItems += items.length;

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
          const { displacementKm, roadDistanceKm, deliveryCharge, returnCharge, estimatedTime } = await calculateDeliveryCharge({
            userCoords,
            merchantCoords,
            deliveryPerKmRate: config.deliveryPerKmRate,
            returnPerKmRate: config.returnPerKmRate,
            waitingCharge: config.waitingCharge
          });
          const TRY_BUY_RADIUS = config.tryAndBuyRadius;
          const isEligibleForTryBuy = displacementKm <= TRY_BUY_RADIUS;
          deliveryInfo = {
            merchantId: merchant._id,
            shopName: merchant.shopName,
            distanceKm: roadDistanceKm,
            deliveryCharge,
            returnCharge,
            estimatedTime,
            isEligibleForTryBuy,
            message: isEligibleForTryBuy ? null : `Merchant is beyond ${TRY_BUY_RADIUS}km for Try & Buy`
          };
          allDeliveryDetails.push(deliveryInfo);
        }
      }

      const enrichedItems = items.map(item => ({ ...item, merchantDelivery: deliveryInfo }));
      allItems.push(...enrichedItems);

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

      let mAppliedOffers = { appliedOffers: [], totalDiscount: 0, freeDelivery: false };
      try {
        const merchantTotals = {};
        merchantTotals[merchantKey] = mSubtotal;
        mAppliedOffers = await findBestOffers(
          userId,
          { items: enrichedItems, subtotal: mSubtotal, merchantTotals, totalDeliveryCharge: mDeliveryCharge, totalReturnCharge: mReturnCharge },
          cart.couponCode,
          cart.selectedOffers
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
        console.error('Offer engine error:', offerErr.message);
      }

      merchantCarts.push({
        merchantId: merchantKey,
        merchantDetails: { _id: merchant?._id, shopName: merchant?.shopName, isOnline: merchant?.isOnline, logo: merchant?.logo },
        items: enrichedItems,
        deliveryDetails: deliveryInfo,
        totals: mTotals,
        appliedOffers: mAppliedOffers,
      });
    }

    return res.status(200).json({
      success: true,
      totalItems: globalTotalItems,
      merchantCarts,
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
  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
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
    const updatedCart = await Cart.findOneAndUpdate({ "items._id": itemId }, { $pull: { items: { _id: itemId } } }, { new: true });
    if (!updatedCart) return res.status(404).json({ success: false, message: "No matching item found in cart." });
    return res.status(200).json({ success: true, message: "Item removed from cart successfully", updatedCart });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartId, quantity } = req.body;
    if (!cartId || typeof quantity !== "number" || quantity < 1) return res.status(400).json({ success: false, message: 'Missing or invalid cartId or quantity' });
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    const item = cart.items.id(cartId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in cart' });
    item.quantity = quantity;
    await cart.save();
    return res.status(200).json({ success: true, message: 'Quantity updated', updatedItem: item });
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
      if (itemIndex > -1) { itemsToMove = [cart.items[itemIndex]]; cart.items.splice(itemIndex, 1); }
    }
    if (itemsToMove.length === 0) return res.status(404).json({ success: false, message: "No items found to move" });
    let courierCart = await CourierCart.findOne({ userId });
    if (!courierCart) courierCart = new CourierCart({ userId, items: [] });
    for (const item of itemsToMove) {
      const existingItem = courierCart.items.find(ci => ci.productId.toString() === item.productId.toString() && ci.variantId.toString() === item.variantId.toString() && ci.size === item.size);
      if (existingItem) existingItem.quantity += item.quantity;
      else courierCart.items.push({ productId: item.productId, variantId: item.variantId, size: item.size, quantity: item.quantity, merchantId: item.merchantId, image: item.image, stockQuantity: item.stockQuantity });
    }
    await cart.save();
    await courierCart.save();
    res.status(200).json({ success: true, message: "Items moved to courier cart" });
  } catch (error) {
    console.error("Move to courier error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const selectOffer = async (req, res) => {
  const userId = req.user.userId;
  const { offerId, targetItemIds } = req.body;
  if (!offerId) return res.status(400).json({ success: false, message: 'offerId is required' });
  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    const exists = cart.selectedOffers.find(o => o.offerId.toString() === offerId.toString());
    if (!exists) { cart.selectedOffers.push({ offerId, targetItemIds: targetItemIds || [] }); await cart.save(); }
    res.status(200).json({ success: true, message: 'Offer selected', selectedOffers: cart.selectedOffers });
  } catch (error) {
    console.error("Select offer error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deselectOffer = async (req, res) => {
  const userId = req.user.userId;
  const { offerId } = req.body;
  if (!offerId) return res.status(400).json({ success: false, message: 'offerId is required' });
  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    cart.selectedOffers = cart.selectedOffers.filter(o => o.offerId.toString() !== offerId.toString());
    await cart.save();
    res.status(200).json({ success: true, message: 'Offer deselected', selectedOffers: cart.selectedOffers });
  } catch (error) {
    console.error("Deselect offer error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

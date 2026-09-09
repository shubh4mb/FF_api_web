import Cart from "../../models/cart.model.js";
import mongoose from "mongoose";
import { log } from "console";
import Address from '../../models/address.model.js'
import { calculateDeliveryCharge } from '../../helperFns/deliveryChargeFns.js'
import AppConfig from "../../models/appConfig.model.js";
import CourierCart from "../../models/courierCart.model.js";
import { findBestOffers } from '../../services/offerEngine.js';
import Offer from "../../models/offer.model.js";
import ProductFlat from '../../models/productFlat.model.js';
import { generateColorVariantId } from '../../utils/variantAdapter.js';

export const addToCart = async (req, res) => {
  const userId = req.user.userId;
  const { productId, variantId, size, quantity, merchantId, image, source } = req.body;
  const effectiveMerchantId = merchantId || (source === 'warehouse' ? 'flashmart' : null);

  if (!productId || !variantId || !size || !quantity || (!effectiveMerchantId && source !== 'warehouse') || !image) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    let sizeObjStock = 0;
    let targetCatName = '';
    let isWarehouseItem = source === 'warehouse';
    let warehouseIdObj = null;

    const matchingFlatVariants = await ProductFlat.find({
      $or: [
        { styleGroupId: productId },
        ...(mongoose.Types.ObjectId.isValid(productId) ? [{ _id: productId }] : []),
        ...(mongoose.Types.ObjectId.isValid(variantId) ? [{ _id: variantId }] : []),
      ],
      size: size,
      isDeleted: { $ne: true }
    }).populate('categoryId');
    const matchedDoc = matchingFlatVariants.find(v => 
      v._id.toString() === variantId ||
      generateColorVariantId(v.styleGroupId || productId, v.color?.name) === variantId
    ) || matchingFlatVariants[0];

    if (!matchedDoc) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (matchedDoc.source === 'warehouse') {
      isWarehouseItem = true;
      warehouseIdObj = matchedDoc.warehouseId;
    }

    if (matchedDoc.stock < quantity) {
      return res.status(400).json({ message: `Only ${matchedDoc.stock} items left in stock` });
    }
    sizeObjStock = matchedDoc.stock;
    targetCatName = matchedDoc.categoryId?.name?.toLowerCase() || '';

    let cart = await Cart.findOne({ userId });

    const targetMult = (targetCatName === 'footwear') ? 2 : 1;

    if (cart) {
      const productIds = cart.items.map(i => i.productId);
      
      const products = await ProductFlat.find({ styleGroupId: { $in: productIds } }).populate('categoryId').lean();
      
      const productMap = products.reduce((acc, p) => { 
        const key = p.styleGroupId ? p.styleGroupId.toString() : p._id.toString();
        acc[key] = p; 
        return acc; 
      }, {});

      // Only count items with the SAME source type (warehouse vs shop) for the limit
      // Warehouse items have their own limit separate from merchant store items
      const itemSource = isWarehouseItem ? 'warehouse' : 'shop';
      const currentMerchantQty = cart.items
        .filter(item => {
          const sameSource = (item.source || 'shop') === itemSource;
          if (isWarehouseItem) {
            // For warehouse items, count all warehouse items (regardless of merchantId)
            return sameSource;
          }
          // For store items, count only store items from the same merchant
          return sameSource && item.merchantId && effectiveMerchantId && item.merchantId.toString() === effectiveMerchantId.toString();
        })
        .reduce((sum, item) => {
          const p = productMap[item.productId.toString()];
          const catName = p?.categoryId?.name?.toLowerCase();
          const mult = (catName === 'footwear') ? 2 : 1;
          return sum + (item.quantity * mult);
        }, 0);

      if (currentMerchantQty + (quantity * targetMult) > 6) {
        const sourceLabel = isWarehouseItem ? 'FlashMart' : 'Try & Buy';
        return res.status(400).json({ message: `You can only have up to 6 ${sourceLabel} item slots per merchant (Footwear items count as 2 slots).` });
      }
    } else {
      if ((quantity * targetMult) > 6) {
        return res.status(400).json({ message: "You can only have up to 6 item slots per merchant (Footwear items count as 2 slots)." });
      }
    }

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{
          productId,
          variantId,
          size,
          quantity,
          stockQuantity: sizeObjStock,
          merchantId,
          image: typeof image === 'string' ? { url: image } : image,
          source: isWarehouseItem ? 'warehouse' : 'shop',
          warehouseId: warehouseIdObj,
          warehouseProductId: isWarehouseItem ? productId : null,
        }],
      });
    } else {
      const existingItem = cart.items.find(item =>
        item.productId?.toString() === productId &&
        item.variantId?.toString() === variantId &&
        item.size === size &&
        (isWarehouseItem ? item.source === 'warehouse' : item.source !== 'warehouse')
      );

      if (existingItem) {
        if ((existingItem.quantity + quantity) > sizeObjStock) {
          return res.status(400).json({ message: `Only ${sizeObjStock} items left in stock` });
        }
        existingItem.quantity += quantity;
        existingItem.stockQuantity = sizeObjStock;
      } else {
        cart.items.push({
          productId,
          variantId,
          size,
          quantity,
          stockQuantity: sizeObjStock,
          merchantId,
          image: typeof image === 'string' ? { url: image } : image,
          source: isWarehouseItem ? 'warehouse' : 'shop',
          warehouseId: warehouseIdObj,
          warehouseProductId: isWarehouseItem ? productId : null,
        });
      }
      cart.updatedAt = new Date();
    }

    await cart.save();
    res.status(200).json({ success: true, message: "Product added to cart", cart });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getCartCount = async (req, res) => {
  const userId = req.user.userId;
  try {
    const cart = await Cart.findOne({ userId }).lean();
    if (!cart) {
      return res.status(200).json({
        success: true,
        totalCarts: 0,
        totalItems: 0,
        items: [],
      });
    }

    const itemsWithVariant = [];
    for (const item of cart.items) {
        if (!item.productId) continue;
        const styleGroupId = item.productId.toString();
        const siblings = await ProductFlat.find({
          $or: [
            { styleGroupId },
            ...(mongoose.Types.ObjectId.isValid(styleGroupId) ? [{ _id: styleGroupId }] : [])
          ],
          size: item.size,
          isDeleted: { $ne: true }
        }).lean();
        const matched = siblings.find(
          (v) => v._id.toString() === item.variantId.toString() || generateColorVariantId(styleGroupId, v.color?.name) === item.variantId.toString()
        ) || siblings[0];

        itemsWithVariant.push({
          ...item,
          productId: styleGroupId,
          price: matched?.price || null,
          mrp: matched?.mrp || null,
        });
      }
      const merchantSet = new Set(cart.items.map(i => i.merchantId?.toString()));
      return res.status(200).json({
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
    let cartQuery = Cart.findOne({ userId })
      .populate("items.merchantId", "shopName address isOnline logo");

    const cartDoc = await cartQuery.exec();

    if (!cartDoc || cartDoc.items.length === 0) {
      return res.status(200).json({
        success: true,
        totalItems: 0,
        merchantCarts: [],
        items: [],
        deliveryDetails: null,
      });
    }

    const cart = cartDoc.toObject();

    for (const item of cart.items) {
      if (!item.productId && !item.warehouseProductId) continue;

      if (item.source === 'warehouse') {
        const whProduct = await ProductFlat.findOne({
          $or: [{ styleGroupId: item.warehouseProductId }, { _id: item.variantId }]
        }).lean();
        if (whProduct) {
          item.productId = whProduct;
          item.price = whProduct.price || 0;
          item.mrp = whProduct.mrp || 0;
        } else {
          item.price = 0;
          item.mrp = 0;
        }
        continue;
      }

      const styleGroupId = item.productId.toString();
      const siblings = await ProductFlat.find({
        $or: [
          { styleGroupId },
          ...(mongoose.Types.ObjectId.isValid(styleGroupId) ? [{ _id: styleGroupId }] : [])
        ],
        size: item.size,
        isDeleted: { $ne: true }
      })
        .populate('categoryId')
        .populate('subCategoryId')
        .populate('brandId')
        .lean();
      if (siblings.length > 0) {
        const matched = siblings.find(
          (v) => v._id.toString() === item.variantId.toString() || generateColorVariantId(styleGroupId, v.color?.name) === item.variantId.toString()
        ) || siblings[0];

        item.productId = {
          ...matched,
          _id: styleGroupId,
        };
        item.price = matched.price || 0;
        item.mrp = matched.mrp || 0;
      } else {
        item.productId = null;
        item.price = 0;
        item.mrp = 0;
      }
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
      let merchant = item.merchantId;
      let merchantKey = merchant?._id?.toString() || item.merchantId?.toString() || 'unknown';

      if (item.source === 'warehouse') {
        merchantKey = 'flashmart';
        merchant = {
          _id: 'flashmart',
          shopName: 'FF FlashMart',
          isOnline: true,
          logo: null,
        };
      }
      
      const price = item.price || 0;
      const mrp = item.mrp || 0;

      if (!merchantGroupMap[merchantKey]) {
        merchantGroupMap[merchantKey] = { merchant, items: [] };
      }
      merchantGroupMap[merchantKey].items.push({ ...item, price, mrp });
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
          const isEligibleForTryBuy = roadDistanceKm <= TRY_BUY_RADIUS;
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

      const mDeliveryCharge = Math.round(deliveryInfo?.deliveryCharge || 0);
      const mReturnCharge = Math.round(deliveryInfo?.returnCharge || 0);
      const tip = Math.round(Number(deliveryTip) || 0);
      const mServiceGST = 0;
      // In Try & Buy, upfront payable is ₹0 (all fees settled post-trial)
      const mUpfrontPayable = 0;

      const mTotals = {
        subtotal: Math.round(mSubtotal),
        mrpTotal: Math.round(mMrpTotal),
        discount: Math.round(mMrpTotal - mSubtotal),
        totalDeliveryCharge: mDeliveryCharge,
        totalReturnCharge: mReturnCharge,
        deliveryTip: tip,
        serviceGST: mServiceGST,
        totalUpfrontPayable: 0,
        finalTotal: Math.round(mSubtotal + mDeliveryCharge + mReturnCharge + tip + mServiceGST),
      };

      let mAppliedOffers = { appliedOffers: [], totalDiscount: 0, freeDelivery: false };
      try {
        const merchantTotals = {};
        merchantTotals[merchantKey] = mSubtotal;
        mAppliedOffers = await findBestOffers(
          userId,
          { items: enrichedItems, subtotal: mSubtotal, merchantTotals, totalDeliveryCharge: mDeliveryCharge, totalReturnCharge: mReturnCharge },
          cart.couponCode,
          cart.selectedOffers,
          'try_and_buy'
        );
        if (mAppliedOffers && mAppliedOffers.freeDelivery) {
          mTotals.totalDeliveryCharge = 0;
          mTotals.totalReturnCharge = 0;
          mTotals.serviceGST = 0;
          mTotals.totalUpfrontPayable = 0;
          mTotals.finalTotal = Math.round(mSubtotal - mAppliedOffers.totalDiscount);
        } else {
          mTotals.totalUpfrontPayable = 0;
          mTotals.finalTotal = Math.round(mSubtotal - (mAppliedOffers.totalDiscount || 0) + mDeliveryCharge + mReturnCharge + tip + mServiceGST);
        }
        mTotals.discount = Math.round((mMrpTotal - mSubtotal) + (mAppliedOffers.totalDiscount || 0));
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
  const { merchantId } = req.query;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    if (merchantId) {
      // Clear only items for this specific merchant
      cart.items = cart.items.filter(item => item.merchantId.toString() !== merchantId.toString());
      // Also clear any selected offers that are only for these items (optional/future)
    } else {
      // Clear entire cart
      cart.items = [];
      cart.selectedOffers = [];
      cart.couponCode = null;
    }

    await cart.save();
    res.status(200).json({ success: true, message: merchantId ? 'Merchant items cleared' : 'Cart cleared' });
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

    const merchantId = item.merchantId.toString();
    
    const productIds = cart.items.map(i => i.productId);
    
    const products = await ProductFlat.find({ styleGroupId: { $in: productIds } }).populate('categoryId').lean();
    
    const productMap = products.reduce((acc, p) => { 
      const key = p.styleGroupId ? p.styleGroupId.toString() : p._id.toString();
      acc[key] = p; 
      return acc; 
    }, {});

    const itemSource = item.source || 'shop';
    const isWarehouseItem = itemSource === 'warehouse';

    const currentMerchantQtyExcludingThisItem = cart.items
      .filter(i => {
        if (i._id.toString() === cartId) return false;
        const sameSource = (i.source || 'shop') === itemSource;
        if (isWarehouseItem) {
          return sameSource;
        }
        return sameSource && i.merchantId && i.merchantId.toString() === merchantId;
      })
      .reduce((sum, i) => {
        const p = productMap[i.productId.toString()];
        const catName = p?.categoryId?.name?.toLowerCase();
        const mult = (catName === 'footwear') ? 2 : 1;
        return sum + (i.quantity * mult);
      }, 0);

    const targetProduct = productMap[item.productId.toString()];
    const targetCatName = targetProduct?.categoryId?.name?.toLowerCase();
    const targetMult = (targetCatName === 'footwear') ? 2 : 1;

    if (currentMerchantQtyExcludingThisItem + (quantity * targetMult) > 6) {
      const sourceLabel = isWarehouseItem ? 'FlashMart' : 'Try & Buy';
      return res.status(400).json({ success: false, message: `You can only have up to 6 ${sourceLabel} item slots per merchant (Footwear items count as 2 slots).` });
    }

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

export const deselectOffer = async (req, res) => {
  const userId = req.user.userId;
  const { offerId } = req.body;
  if (!offerId) return res.status(400).json({ success: false, message: 'offerId is required' });
  try {
    const cart = await Cart.findOne({ userId });
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

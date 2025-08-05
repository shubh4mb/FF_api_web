import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
// controllers/orderController.js
import Cart from '../../models/cart.model.js';

// export const createOrder = async (req, res) => {
//   try {
//     const userId = req.user.userId;

//     // 1. Get user's cart
//     const cart = await Cart.findOne({ userId });
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ error: 'Cart is empty' });
//     }

//     // 2. Generate order items and calculate total
//     let totalAmount = 0;
//     const orderItems = [];

//     for (let item of cart.items) {
//       // Optional: You can fetch product price from DB
//       // const product = await Product.findById(item.productId);
//       // const variant = product.variants.id(item.variantId);
//       // const price = variant.price;

//       const price = 100; // TODO: replace with actual price from DB or cart item

//       orderItems.push({
//         productId: item.productId,
//         variantId: item.variantId,
//         image: item.image,
//         size: item.size,
//         quantity: item.quantity,
//         price: price,
//         merchantId: item.merchantId,
//       });

//       totalAmount += price * item.quantity;
//     }

//     // 3. Create order document
//     const newOrder = new Order({
//       userId,
//       items: orderItems,
//       totalAmount,
//       status: 'placed',
//       paymentStatus: 'pending' // or 'paid' if using fake payment
//     });

//     await newOrder.save();

//     // 4. Clear cart (optional)
//     cart.items = [];
//     await cart.save();

//     return res.status(201).json({ message: 'Order placed successfully', order: newOrder });

//   } catch (error) {
//     console.error("Order creation error:", error);
//     return res.status(500).json({ error: 'Something went wrong while placing the order' });
//   }
// };



export const createOrder = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Step 1: Get user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    // Step 2: Group items by merchantId
    const groupedByMerchant = {};
    for (const item of cart.items) {
      const { merchantId } = item;
      if (!groupedByMerchant[merchantId]) {
        groupedByMerchant[merchantId] = [];
      }
      groupedByMerchant[merchantId].push(item);
    }

    const orders = [];

    // Step 3: Create one order per merchant
    for (const [merchantId, items] of Object.entries(groupedByMerchant)) {
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        // Find variant price and image
        const variant = product.variants.id(item.variantId);
        if (!variant) continue;

        const price = variant.price;
        const name = product.name;
        const image = item.image?.url || variant.images?.[0]?.url || '';

        totalAmount += price * item.quantity;

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId,
          name,
          quantity: item.quantity,
          price,
          size: item.size,
          image,
          tryStatus: product.isTriable ? 'pending' : 'not-triable'
        });
      }

    //   // Step 4: Final billing calculation (can adjust logic)
    //   const tryAndBuyFee = 0; // You may compute based on app settings
    //   const gst = totalAmount * 0.05; // 5% GST for example
    //   const deliveryCharge = 0; // You can make this dynamic
    //   const discount = 0; // Apply coupons if any
    //   const totalPayable = totalAmount + tryAndBuyFee + gst + deliveryCharge - discount;

      const newOrder = new Order({
        userId,
        merchantId,
        items: orderItems,
        totalAmount,
        finalBilling: {
          baseAmount: totalAmount,
          tryAndBuyFee: 0,
          gst: 0,
          discount: 0,
          deliveryCharge: 0,
          totalPayable: totalAmount,
        },
        deliveryLocation: {
          address: req.body.deliveryAddress || '',
          coordinates: req.body.coordinates || [],
        }
      });

      await newOrder.save();
      orders.push(newOrder);
    }

    // Step 5: Clear cart
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    return res.status(201).json({
      message: 'Order(s) placed successfully',
      orders,
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



import ZipCoverOrder from '../../models/zipCoverOrder.model.js';

// Create a new zip cover order
export const createZipCoverOrder = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const { small, medium, large } = req.body;

    // Validate quantities
    const s = parseInt(small) || 0;
    const m = parseInt(medium) || 0;
    const l = parseInt(large) || 0;

    if (s === 0 && m === 0 && l === 0) {
      return res.status(400).json({ message: 'At least one size must have a quantity greater than 0.' });
    }

    if (s > 30 || m > 30 || l > 30) {
      return res.status(400).json({ message: 'Maximum 30 covers per size allowed.' });
    }

    const order = new ZipCoverOrder({
      merchantId,
      quantities: { small: s, medium: m, large: l },
    });

    await order.save();
    return res.status(201).json({ message: 'Zip cover order placed successfully.', order });
  } catch (error) {
    console.error('Error creating zip cover order:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get merchant's zip cover orders
export const getMyZipCoverOrders = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const orders = await ZipCoverOrder.find({ merchantId }).sort({ createdAt: -1 });
    return res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching zip cover orders:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

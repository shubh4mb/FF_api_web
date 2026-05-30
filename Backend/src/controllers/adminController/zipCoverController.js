import ZipCoverOrder from '../../models/zipCoverOrder.model.js';

// Get all zip cover orders
export const getAllZipCoverOrders = async (req, res) => {
  try {
    const orders = await ZipCoverOrder.find()
      .populate('merchantId', 'shopName email phoneNumber address')
      .sort({ createdAt: -1 });
    return res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching zip cover orders for admin:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Update order status
export const updateZipCoverOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await ZipCoverOrder.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (status) order.status = status;
    if (remarks !== undefined) order.remarks = remarks;

    await order.save();
    return res.status(200).json({ message: 'Order updated successfully', order });
  } catch (error) {
    console.error('Error updating zip cover order:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

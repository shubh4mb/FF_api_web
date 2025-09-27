import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import {emitOrderUpdate} from "../../sockets/order.socket.js";
import { io } from "../../../index.js"
import DeliveryRider from "../../models/deliveryRider.model.js";

export const saveProductDetails = async (req, res) => {
  try {
    const { name, description } = req.body;
    const productId = req.params.id;

    // Validate that at least one field is provided
    if (!name && !description) {
      return res.status(400).json({ 
        message: 'At least one of name or description is required' 
      });
    }

    // Validate name if provided
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({ 
        message: 'Product name cannot be empty' 
      });
    }

    // Build update object dynamically
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description;

    // Find and update product
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, isActive: true },
      updateFields,
      { new: true, runValidators: true }
    )
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .populate('merchantId', 'name');

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found or inactive' });
    }

    res.status(200).json({
      message: '✅ Product details updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};



export const getPlacedOrder = async (req, res) => {
  console.log(req.merchantId,'merchantId');
  const orders = await Order.find({ merchantId: req.merchantId, orderStatus: "placed" });
  return res.status(200).json({ orders });
};

export const orderRequestForMerchant = async (req, res) => {
  // console.log("orderRequestForMerchant");
  const { orderId } = req.params;
  // console.log(orderId,'orderId');
  
  const { status } = req.body;
  // console.log(status);
  
  // const { reason } = req.body;
  // console.log(reason);

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });
  
  // order.orderStatus = status;
  if(status=="accept"){
    order.orderStatus="accepted";
    // const deliveryBoy = await DeliveryRider.findOne({status:"active"})
    // if(!deliveryBoy){
    //   return res.status(404).json({ message: "Delivery boy not found" });
    // }
    // order.deliveryBoyId = deliveryBoy._id;
    // order.deliveryBoyStatus = "assigned";    
  }
  
  if(status=="reject"){
    order.orderStatus="rejected";
    order.reason=reason;
  }
  await order.save();

  emitOrderUpdate(io, orderId,order);


  
  return res.status(200).json({ message: "Order status updated", orderId });
};

export const getAllOrder = async (req, res) => {
    try {
      const orders = await Order.find({ merchantId: req.merchantId }).sort({ createdAt: -1 });
      console.log(orders.length,'orders length');
      
      return res.status(200).json({ orders });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching orders" });
    }
}

export const orderPacked = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.orderStatus = "packed";
    await order.save();
    emitOrderUpdate(io, orderId, { status: "packed" });
    return res.status(200).json({ message: "Order status updated", orderId });

  } catch (error) {
    return res.status(500).json({ message: "Error updating order status" });
  }
}








import DeliveryRider from "../../models/deliveryRider.model.js";
import jwt from "jsonwebtoken";
// import { JWT_SECRET } from "../../config.js";

export const register = async (req, res) => {
    try {
      const { name, email, phone, password } = req.body;
      const deliveryRider = new DeliveryRider({ name, email, phone, password });
      await deliveryRider.save();
      res.status(201).json({ message: "Delivery boy created", deliveryRider });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };

export const verifyOTP = async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }
  
      // Check if rider already exists
      let deliveryRider = await DeliveryRider.findOne({ phone });
  
      if (!deliveryRider) {
        // Create a new rider if not exists
        deliveryRider = new DeliveryRider({
          phone,
          isAvailable: true, // default availability
          status: "active", // default status
        });
        
        await deliveryRider.save();
        const token = jwt.sign(
          { id: deliveryRider._id, phone: deliveryRider.phone },
          process.env.JWT_SECRET,
          { expiresIn: "60d" }
        );
        return res
          .status(201)
          .json({ message: "Delivery rider created successfully", deliveryRider, token });
      }
      const token = jwt.sign(
        { id: deliveryRider._id, phone: deliveryRider.phone },
        process.env.JWT_SECRET,
        { expiresIn: "60d" }
      );
      res.status(200).json({ message: "Delivery rider login successfully", deliveryRider, token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
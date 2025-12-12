import Address from "../../models/address.model.js";

// ----------------------------------------
// CREATE Address
// ----------------------------------------
export const createAddress = async (req, res) => {
  try {
    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      area,
      city,
      state,
      pincode,
      country,
      location,
      addressType,
      deliveryInstructions,
      isDefault
    } = req.body;
    console.log(req.body);
    

    const userId = req.user.userId; // From auth middleware
    console.log(req.user);
    

    // If new address is default → unset others
    if (isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

        // ✅ Validate location only if provided
    let validLocation = undefined;

    if (
      location?.coordinates?.length === 2 &&
      typeof location.coordinates[0] === "number" &&
      typeof location.coordinates[1] === "number"
    ) {
      validLocation = {
        type: "Point",
        coordinates: [
          Number(location.coordinates[0]),
          Number(location.coordinates[1])
        ]
      };
    }

    const address = await Address.create({
      user: userId,
      name,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      area,
      city,
      state,
      pincode,
      country,
      location: validLocation,
      addressType,
      deliveryInstructions,
      isDefault
    });

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      address
    });
  } catch (error) {
    console.error("Create Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ----------------------------------------
// GET all user addresses
// ----------------------------------------
export const getAllAddresses = async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log(userId,"asdsadas");
    

    const addresses = await Address.find({ user: userId }).sort({
      isDefault: -1,
      createdAt: -1
    });
    console.log(addresses,"sss");
    

    return res.status(200).json({
      success: true,
      addresses
    });
  } catch (error) {
    console.error("Get Addresses Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ----------------------------------------
// GET single address
// ----------------------------------------
export const getSingleAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    return res.status(200).json({
      success: true,
      address
    });
  } catch (error) {
    console.error("Get Single Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ----------------------------------------
// UPDATE Address
// ----------------------------------------
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      area,
      city,
      state,
      pincode,
      country,
      location,
      addressType,
      deliveryInstructions,
      isDefault
    } = req.body;

    // If setting new default → unset old defaults
    if (isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    // ✅ Validate location only if provided
    let validLocation = undefined;

    if (
      location?.coordinates?.length === 2 &&
      typeof location.coordinates[0] === "number" &&
      typeof location.coordinates[1] === "number"
    ) {
      validLocation = {
        type: "Point",
        coordinates: [
          Number(location.coordinates[0]),
          Number(location.coordinates[1])
        ]
      };
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      {
        name,
        phone,
        addressLine1,
        addressLine2,
        landmark,
        area,
        city,
        state,
        pincode,
        country,
        location: validLocation,
        addressType,
        deliveryInstructions,
        isDefault
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress
    });
  } catch (error) {
    console.error("Update Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ----------------------------------------
// DELETE Address
// ----------------------------------------
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const deleted = await Address.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    // If deleted address was default → make another default
    if (deleted.isDefault) {
      const nextAddress = await Address.findOne({ user: userId }).sort({
        createdAt: -1
      });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully"
    });
  } catch (error) {
    console.error("Delete Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};



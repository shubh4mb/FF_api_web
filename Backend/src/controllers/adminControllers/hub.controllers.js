import Hub from '../../models/hub.model.js';

export const addHub = async (req, res) => {
  try {
    const { name, serviceablePincodes } = req.body;

    if (!name || !serviceablePincodes || !Array.isArray(serviceablePincodes)) {
      return res.status(400).json({ success: false, message: "Name and serviceablePincodes (array) are required" });
    }

    const existingHub = await Hub.findOne({ name });
    if (existingHub) {
      return res.status(400).json({ success: false, message: "Hub with this name already exists" });
    }

    // Sort pincodes in ascending order by code
    serviceablePincodes.sort((a, b) => {
      if (a.code && b.code) return a.code.localeCompare(b.code);
      return 0;
    });

    const hub = new Hub({ name, serviceablePincodes });
    await hub.save();

    res.status(201).json({ success: true, message: "Hub created successfully", hub });
  } catch (error) {
    console.error("Error creating hub:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getAllHubs = async (req, res) => {
  try {
    const hubs = await Hub.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, hubs });
  } catch (error) {
    console.error("Error fetching hubs:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateHub = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, serviceablePincodes, isActive } = req.body;

    const hub = await Hub.findById(id);
    if (!hub) {
      return res.status(404).json({ success: false, message: "Hub not found" });
    }

    if (name) hub.name = name;
    if (serviceablePincodes && Array.isArray(serviceablePincodes)) {
      // Sort pincodes in ascending order by code
      serviceablePincodes.sort((a, b) => {
        if (a.code && b.code) return a.code.localeCompare(b.code);
        return 0;
      });
      hub.serviceablePincodes = serviceablePincodes;
    }
    if (typeof isActive !== 'undefined') hub.isActive = isActive;

    await hub.save();
    res.status(200).json({ success: true, message: "Hub updated successfully", hub });
  } catch (error) {
    console.error("Error updating hub:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const deleteHub = async (req, res) => {
  try {
    const { id } = req.params;
    
    const hub = await Hub.findByIdAndDelete(id);
    if (!hub) {
      return res.status(404).json({ success: false, message: "Hub not found" });
    }

    res.status(200).json({ success: true, message: "Hub deleted successfully" });
  } catch (error) {
    console.error("Error deleting hub:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

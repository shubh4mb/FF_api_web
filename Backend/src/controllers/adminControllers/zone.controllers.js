import Zone from "../../models/zone.model.js";
/**
 * CREATE ZONE
 * @route POST /api/zones
 */
export const addZone = async (req, res) => {
  try {
    const { zoneName, city, state, boundary, centerCoordinaties } = req.body;

    const zone = await Zone.create({
      zoneName,
      city,
      state,
      boundary,
      centerCoordinaties,
    });

    return res.status(201).json({
      success: true,
      message: "Zone created successfully",
      data: zone,
    });
  } catch (error) {
    console.error("Create Zone Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create zone",
      error: error.message,
    });
  }
};

/**
 * GET ALL ZONES
 * @route GET /api/zones
 */
export const getAllZones = async (req, res) => {
  try {
    const zones = await Zone.find();

    return res.status(200).json({
      success: true,
      count: zones.length,
      data: zones,
    });
  } catch (error) {
    console.error("Get All Zones Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zones",
      error: error.message,
    });
  }
};

/**
 * GET SINGLE ZONE BY ID
 * @route GET /api/zones/:id
 */
export const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: zone,
    });
  } catch (error) {
    console.error("Get Zone By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zone",
      error: error.message,
    });
  }
};

/**
 * UPDATE ZONE
 * @route PUT /api/zones/:id
 */
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedZone = await Zone.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedZone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Zone updated successfully",
      data: updatedZone,
    });
  } catch (error) {
    console.error("Update Zone Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update zone",
      error: error.message,
    });
  }
};

/**
 * DELETE ZONE
 * @route DELETE /api/zones/:id
 */
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedZone = await Zone.findByIdAndDelete(id);

    if (!deletedZone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    return res.status(200).json({
      success: true,
     message: "Zone deleted successfully",
      data: deletedZone,
    });
  } catch (error) {
    console.error("Delete Zone Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete zone",
      error: error.message,
    });
  }
};

export const checkZoneOverlap = async (req, res) => {
  console.log(req.body);
  
  try {
    const { polygon } = req.body;

    if (!polygon || !polygon.coordinates) {
      return res.status(400).json({
        success: false,
        message: "Polygon data is required",
      });
    }

    const overlapZone = await Zone.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: polygon
        }
      }
    });

    if (overlapZone) {
      return res.status(200).json({
        success: true,
        overlap: true,
        zone: {
          id: overlapZone._id,
          name: overlapZone.zoneName
        }
      });
    }

    return res.status(200).json({
      success: true,
      overlap: false
    });
  } catch (error) {
    console.error("Check Overlap Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check zone overlap",
      error: error.message
    });
  }
};

import Merchant from "../../models/merchant.model.js";

export const getNearbyMerchants = async (req, res) => {
  try {
    const { gender, strict } = req.query;
    const isStrict = strict === 'true';

    let filter = { isActive: true, isVerified: true };

    if (isStrict) {
      // ── Instant Try (Home): Only online, nearby, and in-zone merchants ──
      if (!req.nearbyMerchantIds || req.nearbyMerchantIds.length === 0) {
        return res.status(200).json({ merchants: [] });
      }
      filter.isOnline = true;
      filter._id = { $in: req.nearbyMerchantIds };
      filter.isZoneLive = true;
    } else {
      // ── Stores View: Nearby (Try & Buy) OR Distant (Courier Enabled) ──
      const nearbyIds = req.nearbyMerchantIds || [];
      filter.$or = [
        { _id: { $in: nearbyIds } },
        { enableCourierDelivery: true }
      ];
    }

    if (gender && gender !== 'All') {
      filter.genderCategory = { $in: [gender, 'Unisex'] };
    }

    const merchants = await Merchant.find(filter)
      .select('shopName logo genderCategory shipsWithinHours isOnline zoneId isZoneLive address')
      .lean();

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);

    // In store page ..only show try and buy tag to those shop who are in zone.
    const merchantsWithNearby = merchants.map(m => ({
      ...m,
      isNearby: nearbySet.has(m._id.toString()) && m.isZoneLive
    }));

    return res.status(200).json({ merchants: merchantsWithNearby });
  } catch (error) {
    console.error('Error fetching nearby merchants:', error);
    res.status(500).json({ message: 'Server error fetching merchants' });
  }
};

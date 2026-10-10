import Merchant from "../../models/merchant.model.js";
import { isBackendInTestMode, getTestMerchant } from "../../helperFns/testModeHelper.js";

export const getNearbyMerchants = async (req, res) => {
  try {
    const { gender, strict } = req.query;
    const isStrict = strict === 'true';

    // ── Testing Mode Override (Isolate to SB Fashion in Stores Tab) ──
    const inTestMode = await isBackendInTestMode();
    if (inTestMode) {
      const testMerchant = await getTestMerchant();
      if (testMerchant) {
        const ProductFlat = (await import("../../models/productFlat.model.js")).default;
        const uniqueTestProducts = (await ProductFlat.distinct('styleGroupId', {
          merchantId: testMerchant._id,
          source: { $ne: 'warehouse' },
          isActive: true,
          isDeleted: { $ne: true }
        })).filter(Boolean);
        const count = uniqueTestProducts.length;
        return res.status(200).json({
          merchants: [{
            ...testMerchant,
            status: 'active',
            isActive: true,
            isOnline: true,
            isZoneLive: true,
            isStoreActive: true,
            stats: {
              ...(testMerchant.stats || {}),
              totalProducts: count
            }
          }]
        });
      }
    }

    // Exclude warehouse-only brands (e.g. Calsioclub) and merchants whose physical store is hidden from physical stores list
    let filter = { isActive: true, isVerified: true, fulfillmentType: { $ne: 'warehouse' }, isStoreActive: { $ne: false } };

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
      const gUpper = gender.toUpperCase();
      const gTitle = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
      const variants = [gender, gUpper, gTitle, gender.toLowerCase(), 'Unisex', 'UNISEX', 'unisex'];
      if (gUpper === 'KIDS' || gUpper === 'BOYS' || gUpper === 'GIRLS') {
        variants.push('Kids', 'KIDS', 'kids', 'Boys', 'BOYS', 'boys', 'Girls', 'GIRLS', 'girls');
      }
      filter.genderCategory = { $in: [...new Set(variants)] };
    }

    const merchants = await Merchant.find(filter)
      .select('shopName logo genderCategory shipsWithinHours isOnline zoneId isZoneLive address backgroundImage rating stats fulfillmentType')
      .lean();

    const ProductFlat = (await import("../../models/productFlat.model.js")).default;
    const merchantsWithCount = await Promise.all(merchants.map(async (m) => {
      const uniqueProducts = (await ProductFlat.distinct('styleGroupId', { merchantId: m._id, isActive: true, isDeleted: { $ne: true } })).filter(Boolean);
      const count = uniqueProducts.length;
      return {
        ...m,
        stats: {
          ...m.stats,
          totalProducts: count
        }
      };
    }));

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);

    // In store page ..only show try and buy tag to those shop who are in zone.
    const merchantsWithNearby = merchantsWithCount.map(m => ({
      ...m,
      isNearby: nearbySet.has(m._id.toString()) && m.isZoneLive
    }));

    // ── Include FlashFits Warehouse as a Virtual Store Card ──
    const warehouseStores = [];
    try {
      const Warehouse = (await import("../../models/warehouse.model.js")).default;
      const activeWarehouses = await Warehouse.find({ isActive: true }).lean();
      const uniqueWarehouseProducts = (await ProductFlat.distinct('styleGroupId', {
        $or: [{ source: 'warehouse' }, { warehouseId: { $exists: true, $ne: null } }],
        isActive: true,
        isDeleted: { $ne: true }
      })).filter(Boolean);
      const totalWarehouseProducts = uniqueWarehouseProducts.length;

      if (activeWarehouses.length > 0) {
        for (const wh of activeWarehouses) {
          const uniqueWh = (await ProductFlat.distinct('styleGroupId', {
            $or: [{ warehouseId: wh._id }, { source: 'warehouse' }],
            isActive: true,
            isDeleted: { $ne: true }
          })).filter(Boolean);
          const whCount = uniqueWh.length;
          warehouseStores.push({
            _id: wh._id.toString(),
            shopName: wh.name || 'FlashFits Warehouse Hub',
            logo: { url: '' },
            backgroundImage: { url: '' },
            genderCategory: ['MEN', 'WOMEN', 'KIDS', 'Unisex'],
            shipsWithinHours: 1,
            isOnline: true,
            isZoneLive: true,
            isNearby: true,
            isWarehouse: true,
            rating: 4.9,
            address: wh.address || { city: 'FlashFits Hub' },
            stats: { totalProducts: whCount > 0 ? whCount : totalWarehouseProducts }
          });
        }
      } else if (totalWarehouseProducts > 0) {
        warehouseStores.push({
          _id: 'ff-warehouse-hub',
          shopName: 'FlashFits Warehouse Hub',
          logo: { url: '' },
          backgroundImage: { url: '' },
          genderCategory: ['MEN', 'WOMEN', 'KIDS', 'Unisex'],
          shipsWithinHours: 1,
          isOnline: true,
          isZoneLive: true,
          isNearby: true,
          isWarehouse: true,
          rating: 4.9,
          address: { city: 'FlashFits Hub' },
          stats: { totalProducts: totalWarehouseProducts }
        });
      }
    } catch (whErr) {
      console.error('Error attaching warehouse store:', whErr.message);
    }

    return res.status(200).json({ merchants: [...warehouseStores, ...merchantsWithNearby] });
  } catch (error) {
    console.error('Error fetching nearby merchants:', error);
    res.status(500).json({ message: 'Server error fetching merchants' });
  }
};

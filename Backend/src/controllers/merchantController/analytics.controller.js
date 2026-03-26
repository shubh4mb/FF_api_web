import Order from "../../models/order.model.js";
import mongoose from "mongoose";

export const getMerchantAnalytics = async (req, res) => {
    try {
        const { merchantId } = req;
        const { startDate, endDate } = req.query;

        let matchStage = { merchantId: new mongoose.Types.ObjectId(merchantId) };

        if (startDate && endDate) {
            matchStage.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        // 1. Overall Stats
        const stats = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalRevenue: { 
                        $sum: { 
                            $cond: [{ $in: ["$orderStatus", ["delivered", "completed"]] }, "$finalBilling.baseAmount", 0] 
                        } 
                    },
                    totalOrders: { $sum: 1 },
                    deliveredOrders: { $sum: { $cond: [{ $in: ["$orderStatus", ["delivered", "completed"]] }, 1, 0] } },
                    pendingOrders: { $sum: { $cond: [{ $in: ["$orderStatus", ["placed", "accepted", "packed", "out_for_delivery", "try phase"]] }, 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
                    returnedOrders: { $sum: { $cond: [{ $in: ["$orderStatus", ["returned", "partially_returned"]] }, 1, 0] } },
                }
            }
        ]);

        // 2. Daily Trend
        const dailyTrend = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { 
                        $sum: { 
                            $cond: [{ $in: ["$orderStatus", ["delivered", "completed"]] }, "$finalBilling.baseAmount", 0] 
                        } 
                    },
                    orders: { $sum: 1 },
                    delivered: { $sum: { $cond: [{ $in: ["$orderStatus", ["delivered", "completed"]] }, 1, 0] } },
                    returns: { $sum: { $cond: [{ $in: ["$orderStatus", ["returned", "partially_returned"]] }, 1, 0] } },
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 3. Top Selling Products
        const topProducts = await Order.aggregate([
            { $match: { ...matchStage, orderStatus: { $in: ["delivered", "completed"] } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    name: { $first: "$items.name" },
                    soldQuantity: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { soldQuantity: -1 } },
            { $limit: 5 }
        ]);

        const formattedStats = stats.length > 0 ? stats[0] : { totalRevenue: 0, totalOrders: 0, deliveredOrders: 0, pendingOrders: 0, cancelledOrders: 0, returnedOrders: 0 };
        const avgOrderValue = formattedStats.totalOrders > 0 ? formattedStats.totalRevenue / formattedStats.totalOrders : 0;
        const returnRate = formattedStats.totalOrders > 0 ? (formattedStats.returnedOrders / formattedStats.totalOrders) * 100 : 0;
        const deliveryRate = formattedStats.totalOrders > 0 ? (formattedStats.deliveredOrders / formattedStats.totalOrders) * 100 : 0;

        res.status(200).json({
            success: true,
            stats: { ...formattedStats, avgOrderValue, returnRate, deliveryRate },
            dailyTrend: dailyTrend.map(d => ({ date: d._id, ...d })),
            topProducts
        });

    } catch (error) {
        console.error("Error fetching merchant analytics:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

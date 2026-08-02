import Order from "../../models/order.model.js";
import mongoose from "mongoose";

export const getMerchantAnalytics = async (req, res) => {
    try {
        const { merchantId } = req;
        const { startDate, endDate } = req.query;

        let matchStage = { merchantId: new mongoose.Types.ObjectId(merchantId) };

        if (startDate && endDate) {
            matchStage.createdAt = {
                $gte: new Date(startDate + "T00:00:00.000Z"),
                $lte: new Date(endDate + "T23:59:59.999Z")
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
                            $cond: [
                                { $in: ["$orderStatus", ["delivered", "completed"]] },
                                { $cond: [{ $gt: ["$finalBilling.baseAmount", 0] }, "$finalBilling.baseAmount", "$totalAmount"] },
                                0
                            ] 
                        } 
                    },
                    totalOrders: { $sum: 1 },
                    deliveredOrders: { $sum: { $cond: [{ $in: ["$orderStatus", ["delivered", "completed"]] }, 1, 0] } },
                    pendingOrders: { $sum: { $cond: [{ $in: ["$orderStatus", ["placed", "accepted", "packed", "in_transit", "try_phase", "selection_made", "return_in_progress"]] }, 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
                    returnedOrders: { 
                        $sum: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $in: ["$orderStatus", ["delivered", "completed"]] },
                                        { 
                                            $gt: [
                                                { 
                                                    $size: { 
                                                        $filter: { 
                                                            input: "$items", 
                                                            as: "item", 
                                                            cond: { $eq: ["$$item.tryStatus", "returned"] } 
                                                        } 
                                                    } 
                                                }, 
                                                0
                                            ] 
                                        }
                                    ]
                                }, 
                                1, 
                                0
                            ] 
                        } 
                    },
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
                            $cond: [
                                { $in: ["$orderStatus", ["delivered", "completed"]] },
                                { $cond: [{ $gt: ["$finalBilling.baseAmount", 0] }, "$finalBilling.baseAmount", "$totalAmount"] },
                                0
                            ] 
                        } 
                    },
                    orders: { $sum: 1 },
                    delivered: { $sum: { $cond: [{ $in: ["$orderStatus", ["delivered", "completed"]] }, 1, 0] } },
                    returns: { 
                        $sum: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $in: ["$orderStatus", ["delivered", "completed"]] },
                                        { 
                                            $gt: [
                                                { 
                                                    $size: { 
                                                        $filter: { 
                                                            input: "$items", 
                                                            as: "item", 
                                                            cond: { $eq: ["$$item.tryStatus", "returned"] } 
                                                        } 
                                                    } 
                                                }, 
                                                0
                                            ] 
                                        }
                                    ]
                                }, 
                                1, 
                                0
                            ] 
                        } 
                    },
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 3. Top Selling Products
        const topProducts = await Order.aggregate([
            { $match: { ...matchStage, orderStatus: { $in: ["delivered", "completed"] } } },
            { $unwind: "$items" },
            { $match: { "items.tryStatus": { $in: ["accepted", "not-triable"] } } },
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
        const avgOrderValue = formattedStats.deliveredOrders > 0 ? formattedStats.totalRevenue / formattedStats.deliveredOrders : 0;
        const returnRate = formattedStats.deliveredOrders > 0 ? (formattedStats.returnedOrders / formattedStats.deliveredOrders) * 100 : 0;
        const deliveryRate = formattedStats.totalOrders > 0 ? (formattedStats.deliveredOrders / formattedStats.totalOrders) * 100 : 0;

        // Fill missing dates in dailyTrend
        const filledTrend = [];
        if (startDate && endDate) {
            const dateMap = new Map(dailyTrend.map(d => [d._id, d]));
            let currDate = new Date(startDate + "T00:00:00.000Z");
            let endD = new Date(endDate + "T00:00:00.000Z");
            
            while (currDate <= endD) {
                const dateStr = currDate.toISOString().split('T')[0];
                filledTrend.push(dateMap.get(dateStr) || {
                    _id: dateStr,
                    revenue: 0,
                    orders: 0,
                    delivered: 0,
                    returns: 0
                });
                currDate.setDate(currDate.getDate() + 1);
            }
        }

        res.status(200).json({
            success: true,
            stats: { ...formattedStats, avgOrderValue, returnRate, deliveryRate },
            dailyTrend: (filledTrend.length > 0 ? filledTrend : dailyTrend).map(d => ({ date: d._id, ...d })),
            topProducts
        });

    } catch (error) {
        console.error("Error fetching merchant analytics:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

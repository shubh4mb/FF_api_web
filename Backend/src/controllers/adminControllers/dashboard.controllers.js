import Order from '../../models/order.model.js';
import CourierOrder from '../../models/courierOrder.model.js';
import Merchant from '../../models/merchant.model.js';

export const getDashboardStats = async (req, res) => {
  try {
    // 1. KPI: Total Order Value (Try & Buy + Courier)
    // Considering orders that are not cancelled or rejected
    const validOrderStatuses = { $nin: ['cancelled', 'rejected'] };

    const tnbAggregation = await Order.aggregate([
      { $match: { orderStatus: validOrderStatuses } },
      { $group: { _id: null, total: { $sum: "$finalBilling.totalPayable" } } }
    ]);
    const tnbTotal = tnbAggregation[0]?.total || 0;

    const courierAggregation = await CourierOrder.aggregate([
      { $match: { orderStatus: validOrderStatuses } },
      { $group: { _id: null, total: { $sum: "$finalBilling.totalPayable" } } }
    ]);
    const courierTotal = courierAggregation[0]?.total || 0;
    const totalOrderValue = tnbTotal + courierTotal;

    // 2. KPI: Active Merchants (enrolled)
    const activeMerchants = await Merchant.countDocuments({ status: 'active' });

    // 2b. KPI: Online Merchants
    const onlineMerchants = await Merchant.countDocuments({ isOnline: true });

    // 3. KPI: Active Try & Buy Orders
    const activeTnbOrders = await Order.countDocuments({ 
      orderStatus: { $nin: ['completed', 'cancelled', 'rejected'] } 
    });

    // 4. KPI: Active Courier Orders
    // Using delivered/completed as terminal states along with cancelled/rejected
    const activeCourierOrders = await CourierOrder.countDocuments({ 
      orderStatus: { $nin: ['delivered', 'completed', 'cancelled', 'rejected'] } 
    });

    // 5. Analytics: Last 30 Days Order vs Return Rate
    // For simplicity, we'll look at the last 6 months (or days). Let's do 7 Days for quick UI, or 6 Months. Let's do daily for the last 30 days.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersByDay = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalOrders: { $sum: 1 },
          returnedOrders: {
            $sum: {
              $cond: [
                { $in: ["$orderStatus", ["cancelled", "return_in_progress"]] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format for chart: { date, totalOrders, returnedOrders, returnRate }
    const analyticsChartData = ordersByDay.map(day => {
      const returnRate = day.totalOrders > 0 
        ? ((day.returnedOrders / day.totalOrders) * 100).toFixed(1) 
        : 0;
      return {
        date: day._id,
        Orders: day.totalOrders,
        Returns: day.returnedOrders,
        ReturnRate: parseFloat(returnRate)
      };
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalOrderValue,
        activeMerchants,
        onlineMerchants,
        activeTnbOrders,
        activeCourierOrders
      },
      charts: {
        orderAnalytics: analyticsChartData
      }
    });

  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

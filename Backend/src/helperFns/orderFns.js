import PendingOrder from '../models/pendingOrders.model.js'; // Your schema from before
import { inferZone } from '../utils/zoneInfer.js'; // Zone mapper (Nominatim or static)
import { io } from '../../index.js'; // Your Socket.io instance
import {assignNearestRider} from '../helperFns/deliveryRiderFns.js';

export async function enqueueOrder(orderData) {
  try {
    const { 
      orderId, 
      merchantId, 
      zoneId,//actually zone Name
      pickupLat, 
      pickupLng, 
      customerLat, 
      customerLng 
    } = orderData;

    

    // Infer zone from pickup (shop) loc—e.g., Edapally from lat/lng
    // const zoneId = await inferZone(pickupLat, pickupLng);
    
    // Build GeoJSON for Mongo (lng first!)
    const pickupLoc = {
      type: 'Point',
      coordinates: [pickupLng, pickupLat]
    };
    const customerLoc = customerLat && customerLng ? {
      type: 'Point',
      coordinates: [customerLng, customerLat]
    } : null;

    // Save to pending_orders
    const orderDoc = new PendingOrder({
      orderId,
      merchantId,
      zoneName:zoneId,
      pickupLoc,
      customerLoc
    });
    
    await orderDoc.save();

    console.log(`✅ Enqueued ${orderId} in zone ${zoneId} (pickup: ${pickupLat}, ${pickupLng})`);

    // Trigger matcher for this zone (Socket.io emit—your rider events will hook this)
    io.emit(`orderQueued:${zoneId}`, { zoneId, orderId });

    return { 
      success: true, 
      zoneId,
      queuedAt: orderDoc.acceptTimestamp 
    };
  } catch (error) {
    console.error('Enqueue error:', error);
    return { success: false, error: error.message };
  }
}

export const matchQueuedOrders = async (zoneId) => {
  try {
    // Pull top 5 FIFO *only* queued orders in zone (sorted by acceptTimestamp)
    const pendingOrders = await PendingOrder
      .find({ zoneName:zoneId, status: 'queued' }) // Filter queued only
      .sort({ acceptTimestamp: 1 }) // Oldest first—FIFO
      .limit(5) // Batch small to keep it snappy
      .lean(); // Fast read, no Mongoose overhead
    // console.log(pendingOrders, "pendingOrders");
    
    if (pendingOrders.length === 0) {
      console.log(`No queued orders in zone ${zoneId}`);
      return;
    }

    // console.log(`🔍 Matching ${pendingOrders.length} queued orders in zone ${zoneId}...`);

    let assignedCount = 0;
    const assignedOrders = []; // Track successes for emit

    // Loop FIFO: Try assign each (your rider fn handles proximity/locks)
    for (const order of pendingOrders) {
      const { orderId, pickupLoc, merchantId } = order;
      
      // Build loc obj for assignNearestRider ({lat, lng})
      const pickupLocation = {
        lat: pickupLoc.coordinates[1], // GeoJSON: [lng, lat] → flip
        lng: pickupLoc.coordinates[0]
      };

      // Minimal payload (expand with order deets if needed)
      const orderPayload = {
        merchantId,
        orderId,
        // Add customerLoc, deliveryAmount, etc., from order doc if avail
      };

      // Call your zoned assign (passes zoneId now, from earlier tweak)
      const assignedRider = await assignNearestRider(zoneId, pickupLocation, orderId, orderPayload);
      
      if (assignedRider) {
        // Update Mongo: Flip to assigned
        await PendingOrder.findOneAndUpdate(
          { orderId },
          { 
            status: 'assigned', 
            assignedRider, 
            assignedAt: new Date() 
          }
        );

        assignedCount++;
        assignedOrders.push({ orderId, assignedRider, zoneId });

        console.log(`✅ Assigned rider ${assignedRider} to order ${orderId} in ${zoneId}`);
        
        // // Quick emit to merchant/rider (via orderId room as in your route)
        // io.to(orderId).emit('orderAssigned', { 
        //   orderId, 
        //   riderId: assignedRider, 
        //   status: 'assigned' 
        // });
      } else {
        console.log(`⏳ No rider for order ${orderId} in ${zoneId}—stays queued`);
        // No update—retry on next trigger
      }
    }

    console.log(`🎯 Completed matching: ${assignedCount}/${pendingOrders.length} assigned in ${zoneId}`);

    // Optional: Zone-wide emit for admin Vite dashboard (e.g., queue depth update)
    if (assignedOrders.length > 0) {
      io.to(`zone:${zoneId}`).emit('zoneOrdersUpdated', { 
        zoneId, 
        assigned: assignedOrders,
        pendingCount: pendingOrders.length - assignedCount 
      });
    }
  } catch (error) {
    console.error('Matcher error:', error);
  }
};
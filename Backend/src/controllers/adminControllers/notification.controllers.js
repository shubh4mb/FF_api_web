import { Expo } from "expo-server-sdk";
import User from "../../models/user.model.js";
import Merchant from "../../models/merchant.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import Notification from "../../models/notification.model.js";
import { getIO } from "../../config/socket.js";

const expo = new Expo();

export const sendBroadcastNotification = async (req, res) => {
    try {
        const { target, title, body } = req.body;

        if (!target || !title || !body) {
            return res.status(400).json({ message: "target, title, and body are required." });
        }

        let pushTokens = [];
        let model;

        if (target === "customers") {
            model = User;
        } else if (target === "merchants") {
            model = Merchant;
        } else if (target === "riders") {
            model = DeliveryRider;
        } else {
            return res.status(400).json({ message: "Invalid target. Must be customers, merchants, or riders." });
        }

        // For customers, only fetch those with push tokens (since they only get push notifications)
        // For merchants/riders, fetch everyone (to ensure they get the websocket/in-app notification)
        let query = {};
        if (target === "customers") {
            query = { expoPushTokens: { $exists: true, $not: { $size: 0 } } };
        }

        const users = await model.find(query).select("expoPushTokens _id");

        for (const user of users) {
            if (user.expoPushTokens && user.expoPushTokens.length > 0) {
                pushTokens.push(...user.expoPushTokens);
            }
            
            // Note: For customers, we are intentionally skipping in-app DB notification entries
            // per the requirement to only send push notifications.
            // But if the target is merchants or riders, they have a dedicated notification UI.
            if (target === "merchants" || target === "riders") {
                const notificationPayload = {
                    type: "admin_notification",
                    title,
                    body,
                    data: {}
                };

                if (target === "merchants") {
                    notificationPayload.merchantId = user._id;
                } else if (target === "riders") {
                    notificationPayload.riderId = user._id;
                }

                const notification = await Notification.create(notificationPayload);

                // Emit socket event
                const io = getIO();
                const room = target === "merchants" ? `merchant:${user._id}` : `rider:${user._id}`;
                io.to(room).emit("notification", {
                    _id: notification._id,
                    ...notificationPayload,
                    createdAt: notification.createdAt,
                });
            }
        }

        // Remove duplicates if any
        pushTokens = [...new Set(pushTokens)];

        let messages = [];
        for (let pushToken of pushTokens) {
            if (!Expo.isExpoPushToken(pushToken)) {
                continue;
            }
            messages.push({
                to: pushToken,
                sound: 'default',
                title,
                body,
                data: {},
            });
        }

        if (messages.length > 0) {
            let chunks = expo.chunkPushNotifications(messages);
            for (let chunk of chunks) {
                try {
                    await expo.sendPushNotificationsAsync(chunk);
                } catch (error) {
                    console.error("Error sending broadcast chunk:", error);
                }
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: `Notification broadcasted successfully to ${pushTokens.length} devices.` 
        });

    } catch (err) {
        console.error("sendBroadcastNotification error:", err);
        return res.status(500).json({ message: "Failed to broadcast notification" });
    }
};

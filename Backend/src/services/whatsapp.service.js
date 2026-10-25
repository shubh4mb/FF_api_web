// ── Silence noisy libsignal internal cryptographic ratchet logs ──
const _origConsoleInfo = console.info;
console.info = function (...args) {
  if (typeof args[0] === 'string' && (args[0].startsWith('Closing session:') || args[0].startsWith('Opening session:'))) {
    return;
  }
  return _origConsoleInfo.apply(console, args);
};

const _origConsoleWarn = console.warn;
console.warn = function (...args) {
  if (typeof args[0] === 'string' && (args[0].startsWith('Session already closed') || args[0].startsWith('Session already open'))) {
    return;
  }
  return _origConsoleWarn.apply(console, args);
};

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import Order from '../models/order.model.js';
import WarehouseOrder from '../models/warehouseOrder.model.js';
import CourierOrder from '../models/courierOrder.model.js';

let waSocket = null;

let isConnected = false;
let currentQR = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

const AUTH_FOLDER = path.join(process.cwd(), 'whatsapp-auth');
export const QR_IMAGE_PATH = path.join(process.cwd(), 'whatsapp_qr.png');


/**
 * Returns formatted array of WhatsApp JIDs for admin recipients
 */
export function getAdminRecipients() {
  const envNumbers = process.env.ADMIN_WHATSAPP_NUMBERS;
  let rawList = [];

  if (envNumbers) {
    rawList = envNumbers.split(',').map((n) => n.trim()).filter(Boolean);
  }

  // Fallback defaults if env is empty
  if (rawList.length === 0) {
    rawList = ['8383823813', '6282671491', '8138834116', '8848999734'];
  }

  return rawList.map((num) => {
    let cleaned = String(num).replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return `${cleaned}@s.whatsapp.net`;
  });
}

/**
 * Initialize WhatsApp connection via Baileys multi-device
 */
export async function initWhatsAppClient(options = {}) {
  if (process.env.ENABLE_WHATSAPP_ALERTS === 'false') {

    console.log('ℹ️ WhatsApp order alerts are disabled via ENABLE_WHATSAPP_ALERTS=false');
    return;
  }

  try {
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`📱 Initializing WhatsApp Client (Baileys v${version.join('.')}, latest: ${isLatest})...`);

    waSocket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['FlashFits Server', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
    });

    waSocket.ev.on('creds.update', saveCreds);

    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        console.log('\n===============================================================');
        console.log('⚡ FLASHFITS WHATSAPP LINKING QR CODE');
        console.log('Scan this QR code in WhatsApp > Linked Devices to enable alerts:');
        console.log('===============================================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\n===============================================================\n');

        // Also save clean PNG image for effortless scanning without terminal distortion
        QRCode.toFile(QR_IMAGE_PATH, qr, { width: 450, margin: 2 })
          .then(() => {
            console.log(`🖼️ Crisp QR image saved to: ${QR_IMAGE_PATH}`);
            console.log('👉 If your terminal scanner is not reading it, double-click whatsapp_qr.png in your folder and scan it directly from your screen!\n');
          })
          .catch((err) => console.error('Failed to save QR image:', err.message));
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
        const shouldReconnect = !isLoggedOut && !isReplaced;

        console.log(`⚠️ WhatsApp connection closed (status code: ${statusCode}). Reconnect: ${shouldReconnect}`);

        if (isLoggedOut) {
          console.warn('❌ WhatsApp logged out. Clearing auth credentials...');
          try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          } catch (e) {
            console.error('Failed to clear whatsapp-auth folder:', e.message);
          }
          currentQR = null;
          // Re-init for fresh QR
          setTimeout(() => initWhatsAppClient(), 3000);
        } else if (isReplaced) {
          console.warn('ℹ️ WhatsApp connection replaced by another active instance (e.g. your main server is running). Session is intact.');
        } else if (shouldReconnect) {
          reconnectAttempts++;
          const delay = Math.min(5000 * reconnectAttempts, MAX_RECONNECT_DELAY);
          console.log(`🔄 Reconnecting WhatsApp in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
          setTimeout(() => initWhatsAppClient(), delay);
        }
      }
 else if (connection === 'open') {
        isConnected = true;
        currentQR = null;
        reconnectAttempts = 0;
        console.log('✅ WhatsApp client connected successfully! Ready to send order alerts.');
        if (fs.existsSync(QR_IMAGE_PATH)) {
          try {
            fs.unlinkSync(QR_IMAGE_PATH);
          } catch (e) {}
        }
      }
    });

    // Support Pairing Code (Link with phone number instead) if requested
    if (options.pairingPhone && !state.creds.registered) {
      setTimeout(async () => {
        try {
          let cleanPhone = String(options.pairingPhone).replace(/\D/g, '');
          if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
          const code = await waSocket.requestPairingCode(cleanPhone);
          console.log('\n===============================================================');
          console.log(`🔑 YOUR WHATSAPP PAIRING CODE: ${code}`);
          console.log('===============================================================');
          console.log('👉 In WhatsApp, tap Linked Devices > Link a Device');
          console.log('👉 Tap "Link with phone number instead" at the bottom');
          console.log(`👉 Enter this code on your phone: ${code}`);
          console.log('===============================================================\n');
        } catch (pairErr) {
          console.error('Failed to generate pairing code:', pairErr.message);
        }
      }, 4000);
    }


    return waSocket;
  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp client:', error.message);
  }
}

/**
 * Returns current WhatsApp connection status
 */
export function getWhatsAppStatus() {
  return {
    isConnected,
    hasQR: !!currentQR,
    qrCode: currentQR,
    recipients: getAdminRecipients(),
  };
}

/**
 * Send raw text message to a specific JID or phone number
 */
export async function sendWhatsAppMessage(toJid, text) {
  let jid = toJid;
  if (!jid.includes('@')) {
    let cleaned = String(jid).replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    jid = `${cleaned}@s.whatsapp.net`;
  }

  // Option: Forward via Evolution API if external URL is provided
  if (process.env.EVOLUTION_API_URL) {
    try {
      const evolutionUrl = process.env.EVOLUTION_API_URL.replace(/\/+$/, '');
      const instance = process.env.EVOLUTION_INSTANCE_NAME || 'flashfits';
      const apiKey = process.env.EVOLUTION_API_KEY || '';

      const resp = await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: jid.split('@')[0],
          text,
        }),
      });
      const data = await resp.json();
      return { success: true, via: 'evolution_api', data };
    } catch (err) {
      console.error('[Evolution API] Send error:', err.message);
    }
  }

  // Direct Baileys connection
  if (!waSocket || !isConnected) {
    console.warn(`[WhatsApp] Alert skipped for ${jid} - WhatsApp client is not connected.`);
    return { success: false, reason: 'not_connected' };
  }

  try {
    await waSocket.sendMessage(jid, { text });
    return { success: true };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send message to ${jid}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Format order details into a clean WhatsApp alert message
 */
export function formatOrderAlertMessage({ order, type }) {
  const shortId = order._id ? order._id.toString().slice(-5).toUpperCase() : 'NEW';

  let typeLabel = 'Store Try & Buy';
  if (type === 'warehouse' || order.fulfillmentType === 'try_and_buy') {
    typeLabel = 'Warehouse Try & Buy';
  } else if (type === 'warehouse_courier' || order.fulfillmentType === 'courier') {
    typeLabel = 'Warehouse Courier';
  } else if (type === 'courier') {
    typeLabel = 'Courier Delivery';
  }

  const customerName = order.deliveryLocation?.name || 'Valued Customer';
  const customerPhone = order.deliveryLocation?.phone || order.userId?.phone || 'N/A';

  const merchantName = order.merchantDetails?.name || order.warehouseDetails?.name || 'FlashFits Partner';

  const addressParts = [
    order.deliveryLocation?.addressLine1,
    order.deliveryLocation?.addressLine2,
    order.deliveryLocation?.landmark,
    order.deliveryLocation?.city,
    order.deliveryLocation?.pincode,
  ].filter(Boolean);
  const addressStr = addressParts.length > 0 ? addressParts.join(', ') : 'Address not specified';

  const itemsList = (order.items || []).map((item, idx) => {
    const sizeStr = item.size ? ` [Size: ${item.size}]` : '';
    const qtyStr = item.quantity ? ` x${item.quantity}` : ' x1';
    const priceStr = item.price ? ` - ₹${item.price}` : '';
    return `${idx + 1}. *${item.name || 'Item'}*${sizeStr}${qtyStr}${priceStr}`;
  }).join('\n');

  const totalAmount = order.totalAmount || 0;
  const deliveryCharge = order.deliveryCharge || 0;
  const totalPayable = order.totalPayable ?? order.finalBilling?.totalPayable ?? totalAmount;
  const paymentMethod = order.paymentMethod ? order.paymentMethod.toUpperCase() : 'ONLINE';
  const paymentStatus = order.paymentStatus ? order.paymentStatus.replace(/_/g, ' ').toUpperCase() : 'PENDING';

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `🛍️ *NEW ORDER PLACED! #${shortId}*
━━━━━━━━━━━━━━━━━━━━
📦 *Fulfillment:* ${typeLabel}
🏪 *Store/Warehouse:* ${merchantName}
👤 *Customer:* ${customerName} (+91 ${customerPhone.replace(/^\+?91/, '')})
📍 *Delivery Address:* ${addressStr}

🛒 *Items Ordered (${order.items?.length || 0}):*
${itemsList || 'No item details'}

💰 *Billing Summary:*
• Item Subtotal: ₹${totalAmount}
• Delivery Fee: ₹${deliveryCharge}
• *Total Payable:* ₹${totalPayable}
💳 *Payment:* ${paymentMethod} (${paymentStatus})
⏰ *Time:* ${now}
━━━━━━━━━━━━━━━━━━━━
⚡ _FlashFits Realtime Operations Alert_`;
}

/**
 * Main trigger: Send order alert to all configured admin WhatsApp numbers
 */
export async function sendOrderAlertToWhatsApp({ orderDoc, orderId, orderType = 'store' }) {
  try {
    let order = orderDoc;

    if (!order && orderId) {
      order = await Order.findById(orderId).populate('userId', 'name phone email').lean();
      if (!order) {
        order = await WarehouseOrder.findById(orderId).populate('userId', 'name phone email').lean();
      }
      if (!order) {
        order = await CourierOrder.findById(orderId).populate('userId', 'name phone email').lean();
      }
    }

    if (!order) {
      console.warn(`[WhatsApp] Order not found for alert (ID: ${orderId})`);
      return;
    }

    const messageText = formatOrderAlertMessage({ order, type: orderType });
    const recipients = getAdminRecipients();

    console.log(`📢 Dispatching WhatsApp order alert for #${order._id?.toString().slice(-5).toUpperCase()} to ${recipients.length} numbers...`);

    const results = await Promise.allSettled(
      recipients.map((jid) => sendWhatsAppMessage(jid, messageText))
    );

    const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
    console.log(`✅ WhatsApp alert sent to ${sentCount}/${recipients.length} recipients.`);
  } catch (err) {
    console.error('❌ Error sending WhatsApp order alert (non-blocking):', err.message);
  }
}

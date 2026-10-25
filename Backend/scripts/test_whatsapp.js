import dotenv from 'dotenv';
dotenv.config();

import { initWhatsAppClient, getWhatsAppStatus, sendWhatsAppMessage, getAdminRecipients } from '../src/services/whatsapp.service.js';

console.log('🚀 Starting WhatsApp Connection Test...');
console.log('Admin Recipients:', getAdminRecipients());

// Check if user passed a phone number as argument: e.g. node scripts/test_whatsapp.js 8383823813
const argPhone = process.argv.slice(2).find((a) => !a.startsWith('-')) || process.env.PAIRING_PHONE;

if (argPhone) {
  console.log(`\n📲 Pairing Code Mode requested for: ${argPhone}`);
} else {
  console.log('\n💡 TIP: If terminal QR is not scanning, you have 2 easy options:');
  console.log('   Option A: Double-click "whatsapp_qr.png" saved in this folder and scan from your screen.');
  console.log('   Option B: Run: npm run whatsapp:connect -- 8383823813 (to get an 8-digit code without camera scanning!)\n');
}

const client = await initWhatsAppClient({ pairingPhone: argPhone });


// Check periodically for connection
let attempts = 0;
const interval = setInterval(async () => {
  attempts++;
  const status = getWhatsAppStatus();

  if (status.isConnected) {
    clearInterval(interval);
    console.log('\n🎉 WhatsApp is connected! Sending test order alert...');

    const sampleOrder = {
      _id: '671600000000000000000123',
      fulfillmentType: 'try_and_buy',
      merchantDetails: { name: 'Zara - Mall of India' },
      deliveryLocation: {
        name: 'FlashFits Operations Test',
        phone: '8383823813',
        addressLine1: 'Test Avenue, Sector 62',
        city: 'Noida',
        pincode: '201301',
      },
      items: [
        { name: 'Oversized Cotton Tee', size: 'L', quantity: 1, price: 999 },
        { name: 'Cargo Pants (Black)', size: '32', quantity: 1, price: 1499 },
      ],
      totalAmount: 2498,
      deliveryCharge: 0,
      totalPayable: 2498,
      paymentMethod: 'online',
      paymentStatus: 'delivery_fee_paid',
    };

    const { formatOrderAlertMessage } = await import('../src/services/whatsapp.service.js');
    const msg = formatOrderAlertMessage({ order: sampleOrder, type: 'store' });

    for (const recipient of status.recipients) {
      console.log(`Sending test alert to ${recipient}...`);
      const res = await sendWhatsAppMessage(recipient, msg);
      console.log(`Result for ${recipient}:`, res);
    }

    console.log('\n✅ All test alerts sent successfully! Exiting test script so your main backend server can hold the connection.');
    setTimeout(() => process.exit(0), 1000);
  } else if (attempts > 30) {
    console.log('Waiting for connection... (Timeout after 60s)');
  }
}, 2000);


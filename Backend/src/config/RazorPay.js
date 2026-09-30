import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

const instance = new Razorpay({
  key_id: key_id || 'dummy_key',
  key_secret: key_secret || 'dummy_secret',
});

// External Services Isolation: Mock Razorpay orders when stress testing
if (process.env.MOCK_PAYMENTS === 'true') {
  console.log('⚠️ [LOAD TEST] MOCK_PAYMENTS=true: Razorpay calls will be simulated locally.');

  instance.orders.create = async (options) => {
    const mockId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      id: mockId,
      entity: 'order',
      amount: options.amount || 0,
      amount_paid: 0,
      amount_due: options.amount || 0,
      currency: options.currency || 'INR',
      receipt: options.receipt || `rcpt_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes: options.notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  };
}

export default instance;
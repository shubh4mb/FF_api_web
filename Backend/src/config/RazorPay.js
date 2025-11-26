import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;
var instance = new Razorpay({
  key_id: key_id,
  key_secret: key_secret,
});

export default instance;
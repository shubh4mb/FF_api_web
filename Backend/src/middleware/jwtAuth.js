import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Merchant from '../models/merchant.model.js';
import DeliveryRider from '../models/deliveryRider.model.js';
import Blacklist from '../models/blacklist.model.js';

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check device ID or IP against Blacklist
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
      const deviceId = req.headers['x-device-id'];

      const blacklistChecks = [];
      if (clientIp) blacklistChecks.push({ type: 'ip', value: clientIp });
      if (deviceId) blacklistChecks.push({ type: 'deviceId', value: String(deviceId).trim() });

      if (blacklistChecks.length > 0) {
        const blacklisted = await Blacklist.findOne({ $or: blacklistChecks });
        if (blacklisted) {
          return res.status(403).json({
            success: false,
            isBlocked: true,
            message: 'Access denied. Your network or device has been suspended due to policy violations.',
          });
        }
      }

      // Check user block status
      const targetUserId = decoded.userId || decoded.id;
      const user = await User.findById(targetUserId).select('isBlocked blockedReason');
      if (user?.isBlocked) {
        return res.status(403).json({
          success: false,
          isBlocked: true,
          message: user.blockedReason || 'Your account has been suspended by administration.',
        });
      }

      req.user = { ...decoded, userId: targetUserId, id: targetUserId };
      next();
    } catch (err) {
      console.log(err);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};

export const authMiddlewareOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Ignore token verification errors for optional auth
      console.log('Optional auth error:', err.message);
    }
  }
  
  next();
};

export const authMiddlewareMerchant = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const merchant = await Merchant.findById(decoded.id).select('status isActive blockedReason');
      if (merchant && (merchant.status === 'suspended' || merchant.isActive === false)) {
        return res.status(403).json({
          success: false,
          isSuspended: true,
          message: merchant.blockedReason || 'Merchant store has been suspended by administration.',
        });
      }

      req.merchantId = decoded.id;
      next();
    } catch (err) {
      console.log(err);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};

export const authMiddlewareMerchantOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.merchantId = decoded.id;
    } catch (err) {
      console.log('Optional merchant auth error:', err.message);
    }
  }
  next();
};

export const authMiddlewareRider = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const rider = await DeliveryRider.findById(decoded.id).select('status blockedReason');
      if (rider && (rider.status === 'suspended' || rider.status === 'blocked')) {
        return res.status(403).json({
          success: false,
          isSuspended: true,
          message: rider.blockedReason || 'Delivery rider account has been suspended by administration.',
        });
      }

      req.riderId = decoded.id;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired', error: 'TokenExpiredError' });
      }
      console.log('Rider auth error:', error.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};

export const authMiddlewareAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Verify admin role if your JWT contains it, e.g., if(decoded.role !== 'admin') throw new Error();
      req.adminId = decoded.id;
      next();
    } catch (error) {
      console.log("Admin Auth Error:", error);
      return res.status(401).json({ message: 'Invalid admin token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
}



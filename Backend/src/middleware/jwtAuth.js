import jwt from 'jsonwebtoken';
const secretkey="hehe"

export const authMiddleware = (req, res, next) => {
    // console.log(req.headers.authorization);
//  console.log("hittingggggggg");
    
    
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log(decoded);
      // console.log("hittingggggggg");
      // console.log(decoded);
      
      req.user = decoded;
      next();
    } catch (err) {
        console.log(err);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};
 
export const authMiddlewareMerchant = (req, res, next) => {
  console.log("hittingggggggg");
    const authHeader = req.headers.authorization;
    // console.log(authHeader,'authHeader');
    
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // console.log(decoded,'decoded');
            
            req.merchantId = decoded.id;
            next();
        } catch (err) {
            console.log(err);
            return res.status(401).json({ message: 'Invalid token' });
        }
    } else {
        return res.status(401).json({ message: 'No token provided' });
    }
}

export const authMiddlewareRider=(req,res,next)=>{
    const authHeader=req.headers.authorization;
    // console.log(authHeader,'authHeader');
    
    if(authHeader){
        const token=authHeader.split(' ')[1];
        try {
            const decoded=jwt.verify(token,process.env.JWT_SECRET);
            // console.log(decoded,'decoded');
            
            req.riderId=decoded.id;
            next();
        } catch (error) {
            console.log(error);
            return res.status(401).json({ message: 'Invalid token' });
        }
    }else{
        return res.status(401).json({ message: 'No token provided' });
    }
}



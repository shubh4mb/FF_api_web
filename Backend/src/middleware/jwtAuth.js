import jwt from 'jsonwebtoken';
const secretkey="hehe"

export const authMiddleware = (req, res, next) => {
    // console.log(req.headers.authorization);
//  console.log("hittingggggggg");
    
    
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, secretkey);
      console.log(decoded);
    //   console.log("hittingggggggg");
      
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



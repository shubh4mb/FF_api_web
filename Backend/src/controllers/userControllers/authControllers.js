import bcrypt from 'bcrypt';
import User from '../../models/user.model.js';
import jwt from 'jsonwebtoken';
const secretkey="hehe"


export const googleLogin = async (req, res) => {
    try {
        const {email, name, image} = req.body;
        const user = await User.findOne({email});
        if(user){
            return res.status(200).json({message: "User already exists", user});
        }
        const newUser = await User.create({email, name, image});
        return res.status(200).json({message: "User created successfully", newUser});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const signup = async (req, res) => {
    console.log("working");
    
    try {
      const { email, password } = req.body;
  
      const user = await User.findOne({ email });
      if (user) {
        return res.status(200).json({ message: 'User already exists' });
      }
  
      // ✅ Encrypt the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
  
      // ✅ Save user with encrypted password
      const newUser = await User.create({
        email,
        password: hashedPassword,
      });
  
      return res.status(200).json({ message: 'User created successfully', user: newUser });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  };

  export const phoneLogin = async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
  
      // Try to find existing user
      let user = await User.findOne({ phoneNumber });
  
      // If not found, create new user
      if (!user) {
        user = await User.create({ phoneNumber });
      }
  
      // Generate JWT
      const token = jwt.sign(
        { userId: user._id, phoneNumber: user.phoneNumber },
        secretkey,
        { expiresIn: "1h" }
      );

      console.log(token,'token');
      
      const userId=user._id
      // Send response
      return res.status(200).json({
        message: "Login successful",
        userId,
        token,
      });
  
    } catch (error) {
      console.error("Phone login error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
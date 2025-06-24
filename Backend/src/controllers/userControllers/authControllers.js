import bcrypt from 'bcrypt';
import User from '../../models/user.model.js';

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
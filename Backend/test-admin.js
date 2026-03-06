import mongoose from 'mongoose';
import Admin from './src/models/admin.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function testLogin() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://admin:admin@cluster0.p7j1p.mongodb.net/olaCars?retryWrites=true&w=majority&appName=Cluster0');

    const adminUser = await Admin.findOne({ email: 'admin@flashfits.com' });
    if (!adminUser) {
        console.log("Admin not found. Creating one...");
        await Admin.create({
            name: "Super Admin",
            email: "admin@flashfits.com",
            password: "admin123",
            role: "superadmin"
        });
        console.log("Admin created! run again");
    } else {
        console.log("Admin found!");
        const valid = await adminUser.isPasswordCorrect('admin123');
        console.log("Password valid?", valid);
    }

    process.exit(0);
}

testLogin();

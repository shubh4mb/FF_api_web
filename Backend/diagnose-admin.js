import mongoose from 'mongoose';
import Admin from './src/models/admin.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function diagnostic() {
    const uri = process.env.MONGODB_URI || 'mongodb+srv://shubhambiswas9899:Shubham%402000@ff.tixzrs2.mongodb.net/?retryWrites=true&w=majority&appName=FF';
    console.log("Connecting to:", uri.split('@')[1] || "Localhost");

    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");

        const admins = await Admin.find({});
        console.log(`Found ${admins.length} admin(s) in collection.`);

        admins.forEach(a => {
            console.log(`- Email: ${a.email}, Role: ${a.role}, HasPassword: ${!!a.password}`);
        });

        if (admins.length === 0) {
            console.log("Seeding a test admin now...");
            const newAdmin = await Admin.create({
                name: "Debug Admin",
                email: "admin@flashfits.com",
                password: "admin123",
                role: "superadmin"
            });
            console.log("Admin created successfully:", newAdmin.email);

            const verify = await Admin.findOne({ email: "admin@flashfits.com" });
            const isMatch = await verify.isPasswordCorrect("admin123");
            console.log("Created admin password verification test:", isMatch ? "PASSED" : "FAILED");
        } else {
            const admin = admins[0];
            const testPass = "admin123";
            const isMatch = await admin.isPasswordCorrect(testPass);
            console.log(`Testing password '${testPass}' for ${admin.email}:`, isMatch ? "MATCH" : "NO MATCH");
        }

    } catch (err) {
        console.error("Diagnostic error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    }
}

diagnostic();

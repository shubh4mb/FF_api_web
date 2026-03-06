import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ---- CONFIGURATION AREA ----
const MONGODB_URI = 'mongodb+srv://shubhambiswas9899:Shubham%402000@ff.tixzrs2.mongodb.net/?retryWrites=true&w=majority&appName=FF';
const ADMIN_EMAIL = 'admin@flashfits.com';
const ADMIN_PASS = 'admin123';
// ----------------------------

const adminSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'superadmin' }
}, { timestamps: true });

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

async function forceSeed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected!");

        // 1. Delete existing if any
        await Admin.deleteOne({ email: ADMIN_EMAIL });
        console.log(`Cleared existing admin with email: ${ADMIN_EMAIL}`);

        // 2. Hash manually to be 100% sure
        const salt = await bcrypt.genSalt(10);
        const hashedHeader = await bcrypt.hash(ADMIN_PASS, salt);

        // 3. Create
        await Admin.create({
            name: "Master Admin",
            email: ADMIN_EMAIL,
            password: hashedHeader,
            role: 'superadmin'
        });

        console.log("------------------------------------------");
        console.log("SUCCESS: Admin user created successfully!");
        console.log(`Email: ${ADMIN_EMAIL}`);
        console.log(`Password: ${ADMIN_PASS}`);
        console.log("------------------------------------------");

    } catch (err) {
        console.error("FATAL ERROR:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

forceSeed();

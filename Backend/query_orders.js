import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://shubhambiswas9899:Shubham%402000@ff.tixzrs2.mongodb.net/preproduction?retryWrites=true&w=majority&appName=FF';

async function run() {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const orders = await db.collection('orders').find({ orderStatus: { $in: ["delivered", "completed"] }, "items.tryStatus": "accepted" }).limit(5).toArray();
    console.log(JSON.stringify(orders, null, 2));
    process.exit(0);
}

run();

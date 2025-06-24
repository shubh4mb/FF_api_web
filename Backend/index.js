import dotenv from 'dotenv';
// console.log('Current file:', import.meta.url);

import connectDB from './src/config/db.js';
import app from './src/app.js'; 

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB();

// app.listen(PORT, () => {
//   console.log(`✅ Server running at http://localhost:${PORT}`);
// });


app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});

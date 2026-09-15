export const staticAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8081",
  "http://192.168.0.102:8081",
  "http://192.168.0.102:5000",
  "http://192.168.0.102:5173",
  "http://192.168.0.102:5174",
  "http://192.168.29.18:5173",
  "http://192.168.29.18:5174",
  "http://192.168.29.18:8081",
  "http://192.168.29.18:5000",
  "http://192.168.29.230:5173",
  "http://192.168.29.230:5174",
  "http://192.168.29.230:8081",
  "http://192.168.29.230:5000",
  "http://192.168.137.1:5173",
  "http://192.168.137.1:5174",
  "http://192.168.137.1:8081",
  "http://192.168.137.1:5000",
  "https://ef2d-2405-201-f001-8ff-ac70-a615-593c-f090.ngrok-free.app",
  "https://d560c68770a1.ngrok-free.app",
  "https://3990b275d1e2.ngrok-free.app",
  "https://ff-api-web.onrender.com",
  "https://ff-api-web-2.onrender.com",
  "https://merchant-module-nine.vercel.app",
  "https://ff-admin-7mp8gqw6i-shubhambiswas9899-gmailcoms-projects.vercel.app",
  "https://ff-admin-smoky.vercel.app",
  "https://merchant.theflashfits.com"
];

export const allowedOrigins = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (
    staticAllowedOrigins.includes(origin) ||
    origin.endsWith(".ngrok-free.app") ||
    origin.endsWith(".ngrok.io") ||
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin)
  ) {
    return callback(null, true);
  }
  return callback(null, false);
};

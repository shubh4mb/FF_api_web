import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlashFits Backend API',
      version: '1.0.0',
      description: 'API documentation for the FlashFits backend services including Auth, Merchant, and User endpoints.',
    },
    servers: [
      {
        url: 'https://ff-api-web-2.onrender.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Ensure we locate the route files correctly independent of where the node process was started
  apis: [
    path.join(process.cwd(), 'src/routes/*.js'),
    path.join(process.cwd(), 'routes/*.js')
  ], 
};

export const swaggerSpec = swaggerJsdoc(options);

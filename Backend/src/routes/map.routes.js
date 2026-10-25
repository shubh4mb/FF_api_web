import express from 'express';
import https from 'https';

const router = express.Router();

// Allowed subdomains and styles to prevent open proxying
const ALLOWED_STYLES = new Set([
  'voyager',
  'voyager_nolabels',
  'voyager_only_labels',
  'voyager_labels_under',
  'light_all',
  'dark_all'
]);

const ALLOWED_SUBDOMAINS = ['a', 'b', 'c', 'd'];

/**
 * Proxy CartoDB raster basemap tiles securely.
 * The client requests:
 * GET /api/map/tiles/:style/:z/:x/:y.png (or @2x.png, etc.)
 * Or with subdomains: /api/map/tiles/:subdomain/:style/:z/:x/:y.png
 */
const handleTileRequest = (req, res) => {
  const { style, z, x, filename } = req.params;
  const subdomain = req.params.subdomain || ALLOWED_SUBDOMAINS[Math.floor(Math.random() * ALLOWED_SUBDOMAINS.length)];

  if (!ALLOWED_STYLES.has(style)) {
    return res.status(400).send('Invalid map style');
  }

  // Basic sanity check on tile coordinates
  const zoom = parseInt(z, 10);
  const tileX = parseInt(x, 10);
  if (isNaN(zoom) || isNaN(tileX) || zoom < 0 || zoom > 22 || tileX < 0) {
    return res.status(400).send('Invalid tile coordinates');
  }

  const apiKey = process.env.CARTO_BASEMAP_KEY || '';
  const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
  const targetSub = ALLOWED_SUBDOMAINS.includes(subdomain) ? subdomain : 'a';

  const cartoUrl = `https://${targetSub}.basemaps.cartocdn.com/rastertiles/${style}/${z}/${tileX}/${filename}${keyQuery}`;

  const request = https.get(
    cartoUrl,
    {
      headers: {
        'User-Agent': 'FlashFits-MapService/1.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 8000
    },
    (cartoRes) => {
      if (cartoRes.statusCode !== 200) {
        res.status(cartoRes.statusCode || 502);
      } else {
        res.status(200);
      }

      // Relay essential caching & content headers
      res.setHeader('Content-Type', cartoRes.headers['content-type'] || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // Cache in app/browser for 7 days
      if (cartoRes.headers['etag']) {
        res.setHeader('ETag', cartoRes.headers['etag']);
      }

      cartoRes.pipe(res);
    }
  );

  request.on('error', (err) => {
    console.error('Error fetching Carto basemap tile:', err.message);
    if (!res.headersSent) {
      res.status(502).send('Error proxying map tile');
    }
  });

  request.on('timeout', () => {
    request.destroy();
    if (!res.headersSent) {
      res.status(504).send('Map tile upstream timeout');
    }
  });
};

// Route without subdomain (e.g., /api/map/tiles/voyager/14/11663/7710.png or @2x.png)
router.get('/tiles/:style/:z/:x/:filename', handleTileRequest);

// Route with subdomain support (e.g., /api/map/tiles/:s/voyager/:z/:x/:y.png)
router.get('/tiles/:subdomain/:style/:z/:x/:filename', handleTileRequest);

export default router;

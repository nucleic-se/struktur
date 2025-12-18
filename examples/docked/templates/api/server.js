// Simple Node.js API server demonstrating database and cache integration
const http = require('http');
const { Client } = require('pg');
const redis = require('redis');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined,
});

let isReady = false;

// Initialize connections
async function initialize() {
  try {
    await dbClient.connect();
    console.log('✓ Database connected');
    
    await redisClient.connect();
    console.log('✓ Redis connected');
    
    // Create example table if not exists
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        path VARCHAR(255) NOT NULL,
        viewed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    isReady = true;
    console.log(`✓ API server ready in ${NODE_ENV} mode`);
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
}

// Request handler
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Health check
    if (req.url === '/health') {
      const status = isReady ? 200 : 503;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isReady ? 'healthy' : 'initializing',
        environment: NODE_ENV,
        uptime: process.uptime(),
      }));
      return;
    }

    // Stats endpoint (with cache)
    if (req.url === '/stats') {
      // Try cache first
      const cached = await redisClient.get('stats:page_views');
      if (cached) {
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        });
        res.end(cached);
        return;
      }

      // Query database
      const result = await dbClient.query('SELECT COUNT(*) as total FROM page_views');
      const stats = {
        total_views: parseInt(result.rows[0].total),
        cached_at: new Date().toISOString(),
      };

      const response = JSON.stringify(stats);
      
      // Cache for 10 seconds
      await redisClient.setEx('stats:page_views', 10, response);
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      });
      res.end(response);
      return;
    }

    // Track page view
    if (req.url === '/track' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { path } = JSON.parse(body);
          await dbClient.query(
            'INSERT INTO page_views (path) VALUES ($1)',
            [path || '/']
          );
          
          // Invalidate stats cache
          await redisClient.del('stats:page_views');
          
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await dbClient.end();
    await redisClient.quit();
    process.exit(0);
  });
});

// Start server
initialize().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`API server listening on port ${PORT}`);
  });
});

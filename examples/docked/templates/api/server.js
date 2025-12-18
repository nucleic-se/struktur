// Todo List API - demonstrating PostgreSQL + Redis integration patterns
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
let stats = { cacheHits: 0, cacheMisses: 0, dbQueries: 0 };

// Cache keys
const CACHE_KEYS = {
  allTodos: 'todos:all',
  activeTodos: 'todos:active',
  stats: 'todos:stats'
};

// Initialize connections and database
async function initialize() {
  try {
    await dbClient.connect();
    console.log('✓ Database connected');
    
    await redisClient.connect();
    console.log('✓ Redis connected');
    
    // Create todos table
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add sample todos if table is empty
    const count = await dbClient.query('SELECT COUNT(*) FROM todos');
    if (parseInt(count.rows[0].count) === 0) {
      await dbClient.query(`
        INSERT INTO todos (title, completed) VALUES 
        ('Try adding a new todo', false),
        ('Mark a todo as complete', false),
        ('See Redis caching in action', false)
      `);
      console.log('✓ Sample todos added');
    }
    
    isReady = true;
    console.log(`✓ Todo API ready in ${NODE_ENV} mode`);
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
}

// Helper: Invalidate all todo caches
async function invalidateCaches() {
  await Promise.all([
    redisClient.del(CACHE_KEYS.allTodos),
    redisClient.del(CACHE_KEYS.activeTodos),
    redisClient.del(CACHE_KEYS.stats)
  ]);
}

// Request handler
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Health check with service details
    if (req.url === '/health') {
      const status = isReady ? 200 : 503;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isReady ? 'healthy' : 'initializing',
        environment: NODE_ENV,
        uptime: process.uptime(),
        stats: stats
      }));
      return;
    }

    // GET /todos - List all todos (with cache)
    if (req.url === '/todos' && req.method === 'GET') {
      const cached = await redisClient.get(CACHE_KEYS.allTodos);
      if (cached) {
        stats.cacheHits++;
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        });
        res.end(cached);
        return;
      }

      stats.cacheMisses++;
      stats.dbQueries++;
      
      const result = await dbClient.query(
        'SELECT * FROM todos ORDER BY created_at DESC'
      );
      
      const todos = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        completed: row.completed,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
      
      const response = JSON.stringify(todos);
      await redisClient.setEx(CACHE_KEYS.allTodos, 30, response);
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      });
      res.end(response);
      return;
    }

    // POST /todos - Create new todo
    if (req.url === '/todos' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { title } = JSON.parse(body);
          
          if (!title || title.trim().length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Title is required' }));
            return;
          }

          stats.dbQueries++;
          const result = await dbClient.query(
            'INSERT INTO todos (title) VALUES ($1) RETURNING *',
            [title.trim()]
          );
          
          await invalidateCaches();
          
          const todo = result.rows[0];
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: todo.id,
            title: todo.title,
            completed: todo.completed,
            created_at: todo.created_at,
            updated_at: todo.updated_at
          }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // PUT /todos/:id - Update todo
    const updateMatch = req.url.match(/^\/todos\/(\d+)$/);
    if (updateMatch && req.method === 'PUT') {
      const id = parseInt(updateMatch[1]);
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const updates = [];
          const values = [];
          let paramIndex = 1;

          if (data.title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(data.title.trim());
          }
          if (data.completed !== undefined) {
            updates.push(`completed = $${paramIndex++}`);
            values.push(data.completed);
          }
          
          if (updates.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No updates provided' }));
            return;
          }

          updates.push(`updated_at = NOW()`);
          values.push(id);

          stats.dbQueries++;
          const result = await dbClient.query(
            `UPDATE todos SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
          );

          if (result.rows.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Todo not found' }));
            return;
          }

          await invalidateCaches();
          
          const todo = result.rows[0];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: todo.id,
            title: todo.title,
            completed: todo.completed,
            created_at: todo.created_at,
            updated_at: todo.updated_at
          }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // DELETE /todos/:id - Delete todo
    const deleteMatch = req.url.match(/^\/todos\/(\d+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      const id = parseInt(deleteMatch[1]);
      
      stats.dbQueries++;
      const result = await dbClient.query('DELETE FROM todos WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Todo not found' }));
        return;
      }

      await invalidateCaches();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id }));
      return;
    }

    // GET /stats - Todo statistics
    if (req.url === '/stats' && req.method === 'GET') {
      const cached = await redisClient.get(CACHE_KEYS.stats);
      if (cached) {
        stats.cacheHits++;
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        });
        res.end(cached);
        return;
      }

      stats.cacheMisses++;
      stats.dbQueries++;
      
      const result = await dbClient.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE completed = true) as completed,
          COUNT(*) FILTER (WHERE completed = false) as active
        FROM todos
      `);
      
      const todoStats = {
        total: parseInt(result.rows[0].total),
        completed: parseInt(result.rows[0].completed),
        active: parseInt(result.rows[0].active),
        cache_stats: stats,
        generated_at: new Date().toISOString()
      };
      
      const response = JSON.stringify(todoStats);
      await redisClient.setEx(CACHE_KEYS.stats, 10, response);
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      });
      res.end(response);
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

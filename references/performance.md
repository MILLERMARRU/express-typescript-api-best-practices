# Performance Optimization

## Database Query Optimization

### 1. N+1 Query Problem

```typescript
// ❌ BAD: N+1 queries (1 + N)
const usuarios = await Usuario.findAll();  // 1 query
for (const usuario of usuarios) {
  usuario.roles = await usuario.getRoles();  // N queries
}

// ✅ GOOD: Single query with JOIN
const usuarios = await Usuario.findAll({
  include: [{
    model: Rol,
    as: "roles",
    through: { attributes: [] }  // Hide join table
  }]
});
```

### 2. Selective Field Loading

```typescript
// ❌ BAD: Load all fields (including large TEXT fields)
const productos = await Producto.findAll();

// ✅ GOOD: Load only needed fields
const productos = await Producto.findAll({
  attributes: ['id', 'nombre', 'precio']  // Exclude 'descripcion_larga'
});

// Exclude sensitive fields
const usuarios = await Usuario.findAll({
  attributes: { exclude: ['password'] }
});
```

### 3. Batch Loading (DataLoader Pattern)

```typescript
// Preload related data in batch
const productoIds = [...new Set(detalles.map(d => d.producto_id))];

const productos = await Producto.findAll({
  where: { id: productoIds }
});

const productoMap = new Map(productos.map(p => [p.id, p]));

// Access from map (O(1) lookup)
for (const detalle of detalles) {
  const producto = productoMap.get(detalle.producto_id);
}
```

### 4. Pagination

```typescript
export const obtenerUsuarios = async (page: number = 1, limit: number = 10) => {
  const offset = (page - 1) * limit;

  const { rows, count } = await Usuario.findAndCountAll({
    limit,
    offset,
    order: [['id', 'ASC']]
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};
```

### 5. Indexing

```typescript
// Model definition with indexes
Usuario.init({
  username: {
    type: DataTypes.STRING(50),
    unique: true  // Creates index automatically
  },
  email: {
    type: DataTypes.STRING(100),
    unique: true
  },
  activo: {
    type: DataTypes.BOOLEAN
  }
}, {
  indexes: [
    { fields: ['activo'] },  // Index for filtering
    { fields: ['created_at'] },  // Index for sorting
    { fields: ['email', 'activo'] }  // Composite index
  ]
});
```

### 6. Database Connection Pooling

```typescript
// src/config/db.ts
export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  pool: {
    max: 10,       // Maximum connections
    min: 2,        // Minimum connections
    acquire: 30000,  // Max time to get connection (30s)
    idle: 10000    // Max idle time before release (10s)
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});
```

## Caching Strategies

### 1. In-Memory Cache (Simple)

```typescript
// src/utils/cache.ts
class SimpleCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  set(key: string, value: any, ttl: number = 300000) {  // 5 min default
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);

    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new SimpleCache();

// Usage
export const obtenerRoles = async () => {
  const cacheKey = 'roles:all';
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const roles = await Rol.findAll();
  cache.set(cacheKey, roles, 600000);  // Cache for 10 minutes

  return roles;
};
```

### 2. Redis Cache (Production)

```typescript
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD
});

export const getCached = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> => {
  // Try to get from cache
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const data = await fetcher();

  // Store in cache
  await redis.setex(key, ttl, JSON.stringify(data));

  return data;
};

// Usage
export const obtenerProductos = async () => {
  return await getCached(
    'productos:all',
    () => Producto.findAll(),
    600  // 10 minutes
  );
};
```

### 3. Cache Invalidation

```typescript
// Invalidate cache on update
export const actualizarProducto = async (id: number, data: any) => {
  const producto = await Producto.findByPk(id);

  if (!producto) throw new Error("Producto no encontrado");

  await producto.update(data);

  // Invalidate related caches
  cache.delete('productos:all');
  cache.delete(`producto:${id}`);

  return producto;
};
```

## Response Compression

```typescript
import compression from "compression";

// Compress all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6  // Compression level (0-9)
}));
```

## Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Max 100 requests per window
  message: {
    status: "error",
    message: "Demasiadas solicitudes, por favor intenta más tarde",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/v1/', limiter);

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    status: "error",
    message: "Demasiados intentos de inicio de sesión",
    code: "AUTH_RATE_LIMIT_EXCEEDED"
  }
});

app.post('/v1/usuarios/login', authLimiter, login);
```

## Optimized Bulk Operations

```typescript
// ✅ GOOD: Bulk insert (single transaction)
await DetalleVenta.bulkCreate(detalles, { transaction });

// ❌ BAD: Individual inserts (multiple transactions)
for (const detalle of detalles) {
  await DetalleVenta.create(detalle, { transaction });
}

// ✅ GOOD: Bulk update
await Producto.update(
  { precio: sequelize.literal('precio * 1.1') },  // 10% increase
  { where: { categoria: 'vinos' } }
);

// ❌ BAD: Individual updates
const productos = await Producto.findAll({ where: { categoria: 'vinos' } });
for (const producto of productos) {
  producto.precio *= 1.1;
  await producto.save();
}
```

## Lazy Loading vs Eager Loading

```typescript
// Lazy loading (multiple queries)
const usuario = await Usuario.findByPk(1);
const roles = await usuario.getRoles();  // Separate query

// Eager loading (single query with JOIN)
const usuario = await Usuario.findByPk(1, {
  include: [{ model: Rol, as: "roles" }]
});

// Conditional eager loading
const includeRoles = req.query.include === 'roles';

const usuario = await Usuario.findByPk(1, {
  include: includeRoles ? [{ model: Rol, as: "roles" }] : []
});
```

## Database Query Logging

```typescript
// Enable query logging in development
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  logging: (sql, timing) => {
    console.log(`[${timing}ms] ${sql}`);
  },
  benchmark: true  // Include execution time
});

// Disable in production
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  logging: false
});
```

## Profiling Slow Queries

```typescript
// Middleware to log slow requests
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (duration > 1000) {  // Log requests > 1s
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });

  next();
});
```

## Memory Optimization

### 1. Streaming Large Responses

```typescript
// ❌ BAD: Load entire dataset into memory
export const exportarProductos = async (req: Request, res: Response) => {
  const productos = await Producto.findAll();  // Could be millions!
  res.json(productos);
};

// ✅ GOOD: Stream data
import { Transform } from 'stream';

export const exportarProductos = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.write('[');

  let first = true;

  const stream = await Producto.findAll({
    attributes: ['id', 'nombre', 'precio'],
    raw: true,
    stream: true  // Sequelize streaming (if supported by dialect)
  });

  for await (const producto of stream) {
    if (!first) res.write(',');
    res.write(JSON.stringify(producto));
    first = false;
  }

  res.write(']');
  res.end();
};
```

### 2. Avoid Loading Large Fields

```typescript
// Exclude large TEXT/BLOB fields unless needed
const productos = await Producto.findAll({
  attributes: { exclude: ['descripcion_larga', 'imagen_data'] }
});
```

## Parallel Execution

```typescript
// ❌ SLOW: Sequential execution
const usuarios = await Usuario.findAll();
const productos = await Producto.findAll();
const ventas = await Venta.findAll();

// ✅ FAST: Parallel execution
const [usuarios, productos, ventas] = await Promise.all([
  Usuario.findAll(),
  Producto.findAll(),
  Venta.findAll()
]);
```

## Production Optimizations

### 1. Enable Production Mode

```typescript
// package.json
{
  "scripts": {
    "build": "tsc",
    "start": "NODE_ENV=production node dist/index.js"
  }
}
```

### 2. Use PM2 for Clustering

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: './dist/index.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};

# Start with PM2
pm2 start ecosystem.config.js
```

### 3. Enable HTTP/2

```typescript
import http2 from 'http2';
import fs from 'fs';

const server = http2.createSecureServer({
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem')
}, app);

server.listen(PORT);
```

## Monitoring Performance

### 1. Response Time Middleware

```typescript
import responseTime from 'response-time';

app.use(responseTime((req, res, time) => {
  console.log(`${req.method} ${req.url} - ${time.toFixed(2)}ms`);
}));
```

### 2. APM Integration (New Relic / Datadog)

```typescript
import newrelic from 'newrelic';

// Automatically instruments Express, database queries, etc.
```

### 3. Custom Metrics

```typescript
const metrics = {
  requests: 0,
  errors: 0,
  avgResponseTime: 0
};

app.use((req, res, next) => {
  metrics.requests++;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.avgResponseTime =
      (metrics.avgResponseTime * (metrics.requests - 1) + duration) / metrics.requests;

    if (res.statusCode >= 500) {
      metrics.errors++;
    }
  });

  next();
});

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(metrics);
});
```

## Load Testing

```bash
# Apache Bench
ab -n 1000 -c 10 http://localhost:3000/v1/productos

# autocannon (Node.js)
npx autocannon -c 10 -d 30 http://localhost:3000/v1/productos

# k6 (Grafana)
k6 run load-test.js
```

```javascript
// load-test.js (k6)
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 }
  ]
};

export default function() {
  let res = http.get('http://localhost:3000/v1/productos');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  });
}
```

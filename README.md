# Express + TypeScript REST API Best Practices

> Professional-grade skill for building production-ready REST APIs with Express.js and TypeScript

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/MILLERMARRU/express-typescript-api-best-practices)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![GitHub Stars](https://img.shields.io/github/stars/MILLERMARRU/express-typescript-api-best-practices?style=social)](https://github.com/MILLERMARRU/express-typescript-api-best-practices/stargazers)

## 📋 Overview

This skill provides comprehensive guidance for building enterprise-grade REST APIs with Express.js and TypeScript, following **SOLID principles**, **layered architecture**, and **industry best practices**.

### What You'll Learn

✅ **Layered Architecture** - Separation of concerns with Routes → Controllers → Services → Models
✅ **Transaction Management** - ACID-compliant multi-step operations with Sequelize
✅ **JWT Authentication** - Secure token-based auth with Argon2 password hashing
✅ **Role-Based Authorization (RBAC)** - Flexible many-to-many role system
✅ **Input Validation** - Type-safe validation with Zod schemas
✅ **OpenAPI/Swagger** - Comprehensive API documentation
✅ **Error Handling** - Centralized error management with custom error classes
✅ **Performance Optimization** - Query optimization, caching, pagination
✅ **Security Best Practices** - Rate limiting, HTTPS, secure headers
✅ **Testing Strategies** - Unit and integration testing patterns

## 🚀 Quick Start

### Installation

```bash
# Using npx (recommended)
npx skills add MILLERMARRU/express-typescript-api-best-practices

# Or install globally
npm install -g skills-cli
skills add MILLERMARRU/express-typescript-api-best-practices
```

### Usage in Claude Code

Once installed, Claude Code will automatically use this skill when:
- Building or refactoring Express.js + TypeScript APIs
- Implementing authentication or authorization
- Setting up database transactions
- Creating REST API endpoints
- Optimizing API performance

You can explicitly invoke the skill:
```
Use the express-typescript-api-best-practices skill to create a new REST API endpoint for user management
```

## 📚 Documentation

### Core Files

- **[SKILL.md](SKILL.md)** - Main skill documentation with quick reference
- **[references/architecture.md](references/architecture.md)** - Detailed layered architecture guide
- **[references/transactions.md](references/transactions.md)** - Transaction management patterns
- **[references/auth-rbac.md](references/auth-rbac.md)** - Complete auth & RBAC implementation
- **[references/validation.md](references/validation.md)** - Zod validation strategies
- **[references/error-handling.md](references/error-handling.md)** - Error management patterns
- **[references/performance.md](references/performance.md)** - Performance optimization techniques

## 🏗️ Architecture Principles

### 1. Layered Architecture (SOLID)

```
┌─────────────────────────────────────┐
│  Routes (v1/routes/)                │  ← HTTP routing
├─────────────────────────────────────┤
│  Middleware (middlewares/)          │  ← Auth, validation
├─────────────────────────────────────┤
│  Controllers (controllers/)         │  ← HTTP handlers
├─────────────────────────────────────┤
│  Services (services/)               │  ← Business logic
├─────────────────────────────────────┤
│  Models (models/)                   │  ← Data models
├─────────────────────────────────────┤
│  Database (MySQL/PostgreSQL)        │  ← Persistence
└─────────────────────────────────────┘
```

### 2. Standardized Response Format

All endpoints return consistent JSON:

```typescript
// Success
{
  "status": "ok",
  "message": "Operation successful",
  "data": { /* ... */ }
}

// Error
{
  "status": "error",
  "message": "Error description",
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### 3. Transaction-Safe Operations

```typescript
const transaction = await sequelize.transaction();
try {
  // Multiple database operations
  await operation1(transaction);
  await operation2(transaction);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

## 🔐 Security Features

- ✅ **JWT Authentication** with secure token generation
- ✅ **Argon2 Password Hashing** (winner of PHC 2015)
- ✅ **Role-Based Access Control (RBAC)** with many-to-many roles
- ✅ **Input Validation** with Zod (prevents SQL injection, XSS)
- ✅ **Rate Limiting** for auth endpoints
- ✅ **HTTPS Enforcement** in production
- ✅ **Security Headers** with Helmet.js

## 📊 Performance Best Practices

- ✅ **N+1 Query Prevention** with eager loading
- ✅ **Database Connection Pooling**
- ✅ **Redis Caching** for frequently accessed data
- ✅ **Pagination** for large datasets
- ✅ **Database Indexing** on frequently queried fields
- ✅ **Response Compression** with gzip
- ✅ **Query Optimization** with selective field loading

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

## 📦 Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 18+, TypeScript 5+ |
| **Framework** | Express.js 5+ |
| **ORM** | Sequelize 6+ |
| **Database** | MySQL 8+ / PostgreSQL 14+ |
| **Validation** | Zod 3+ |
| **Authentication** | JWT (jsonwebtoken), Argon2 |
| **Documentation** | Swagger/OpenAPI 3.0 |
| **Testing** | Jest, Supertest |

## 🎯 Use Cases

This skill is perfect for:

- ✅ Building new REST APIs from scratch
- ✅ Refactoring existing Express.js projects
- ✅ Implementing authentication & authorization
- ✅ Adding transaction support to database operations
- ✅ Creating comprehensive API documentation
- ✅ Optimizing API performance
- ✅ Implementing input validation
- ✅ Setting up error handling

## 🤝 Contributing

This skill was built based on production code from real-world projects. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-pattern`)
3. Commit your changes (`git commit -m 'Add amazing pattern'`)
4. Push to the branch (`git push origin feature/amazing-pattern`)
5. Open a Pull Request

## 📝 Examples

### Create a New Endpoint

```typescript
// 1. Define schema (src/schemas/producto.schema.ts)
export const createProductoSchema = z.object({
  body: z.object({
    nombre: z.string().min(3),
    precio: z.number().positive()
  })
});

// 2. Create service (src/services/producto.service.ts)
export const crearProducto = async (data: CreateProductoInput) => {
  return await Producto.create(data);
};

// 3. Create controller (src/controllers/producto.controller.ts)
export const createProducto = async (req: Request, res: Response) => {
  try {
    const producto = await crearProducto(req.body);
    res.status(201).json({ status: "ok", data: producto });
  } catch (error: any) {
    res.status(500).json({ status: "error", error: error.message });
  }
};

// 4. Define route (src/v1/routes/producto.route.ts)
router.post(
  "/",
  autenticarToken,
  verificarRol("admin"),
  validate(createProductoSchema),
  createProducto
);
```

## 🌟 Features

### Authentication & Authorization

- JWT-based authentication
- Many-to-many role system
- Role caching for performance
- Granular permission control

### Input Validation

- Type-safe validation with Zod
- Custom error messages
- Request transformation
- Query parameter validation

### Transaction Management

- ACID compliance
- Pessimistic locking
- Bulk operations
- Deadlock prevention

### Error Handling

- Centralized error handler
- Custom error classes
- Structured logging
- Graceful shutdown

## 📈 Performance

Optimized for production use:

- **Query Performance:** N+1 prevention, indexing, selective loading
- **Caching:** Redis integration for frequently accessed data
- **Concurrency:** Connection pooling, PM2 clustering
- **Monitoring:** APM integration, metrics endpoints

## 🔧 Configuration

### Environment Variables

```bash
# Server
SERVER_HOST=localhost
SERVER_PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=database

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1h

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📖 Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [Zod Documentation](https://zod.dev/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## 📄 License

MIT © Miller Marru

## 🙏 Acknowledgments

This skill is based on real-world production code from enterprise-level projects, refined through years of experience building scalable REST APIs.

## 📧 Contact

- **Author**: Miller Marru
- **Email**: millermarru4@gmail.com
- **GitHub**: [@MILLERMARRU](https://github.com/MILLERMARRU)
- **Repository**: [express-typescript-api-best-practices](https://github.com/MILLERMARRU/express-typescript-api-best-practices)

---

**Developed by Miller Marru with ❤️ for the developer community**

For questions, issues, or feedback, please open an issue on [GitHub](https://github.com/MILLERMARRU/express-typescript-api-best-practices/issues) or contact me directly.

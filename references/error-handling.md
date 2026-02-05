# Error Handling Patterns

## Centralized Error Handling

### Error Handler Middleware

```typescript
// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error for debugging
  console.error("Error:", {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Handle custom AppError
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
      code: error.code,
      details: error.details
    });
    return;
  }

  // Handle Sequelize errors
  if (error.name === "SequelizeUniqueConstraintError") {
    const field = (error as any).errors[0]?.path || "campo";
    res.status(400).json({
      status: "error",
      message: "Error de validación",
      error: `El ${field} ya existe`,
      code: "UNIQUE_CONSTRAINT_VIOLATION"
    });
    return;
  }

  if (error.name === "SequelizeForeignKeyConstraintError") {
    res.status(400).json({
      status: "error",
      message: "Error de integridad referencial",
      error: "Referencia a un registro que no existe",
      code: "FOREIGN_KEY_CONSTRAINT_VIOLATION"
    });
    return;
  }

  if (error.name === "SequelizeValidationError") {
    const messages = (error as any).errors.map((e: any) => e.message).join(", ");
    res.status(400).json({
      status: "error",
      message: "Error de validación",
      error: messages,
      code: "VALIDATION_ERROR"
    });
    return;
  }

  // Default internal server error
  res.status(500).json({
    status: "error",
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? error.message : "Ocurrió un error inesperado",
    code: "INTERNAL_SERVER_ERROR"
  });
};

// Mount at the end of middleware chain
app.use(errorHandler);
```

### Usage in Services

```typescript
// src/services/usuarios/usuarios.service.ts
import { AppError } from "../../middlewares/errorHandler";

export const crearUsuario = async (data: any) => {
  const existeUsername = await Usuario.findOne({ where: { username: data.username } });

  if (existeUsername) {
    throw new AppError(
      400,
      `El username "${data.username}" ya está en uso`,
      "USERNAME_ALREADY_EXISTS"
    );
  }

  const existeEmail = await Usuario.findOne({ where: { email: data.email } });

  if (existeEmail) {
    throw new AppError(
      400,
      `El email "${data.email}" ya está en uso`,
      "EMAIL_ALREADY_EXISTS",
      { field: "email", value: data.email }  // Optional details
    );
  }

  // ... create user
};
```

## Async Error Handling

### Express 5+ (Native Async Support)

```typescript
// Express 5+ handles async errors automatically
export const getUsuarios = async (req: Request, res: Response) => {
  const usuarios = await obtenerUsuarios();  // Errors automatically caught
  res.json({ status: "ok", data: usuarios });
};
```

### Express 4 (Use Wrapper)

```typescript
// Async wrapper for Express 4
const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
export const getUsuarios = asyncHandler(async (req: Request, res: Response) => {
  const usuarios = await obtenerUsuarios();
  res.json({ status: "ok", data: usuarios });
});
```

## Error Categories

### 1. Client Errors (4xx)

```typescript
// 400 Bad Request - Invalid input
throw new AppError(400, "Datos de entrada inválidos", "BAD_REQUEST");

// 401 Unauthorized - Missing authentication
throw new AppError(401, "Autenticación requerida", "UNAUTHORIZED");

// 403 Forbidden - Insufficient permissions
throw new AppError(403, "Permisos insuficientes", "FORBIDDEN");

// 404 Not Found - Resource doesn't exist
throw new AppError(404, "Recurso no encontrado", "NOT_FOUND");

// 409 Conflict - Resource conflict (e.g., duplicate)
throw new AppError(409, "El recurso ya existe", "CONFLICT");

// 422 Unprocessable Entity - Validation failed
throw new AppError(422, "Validación fallida", "VALIDATION_ERROR");
```

### 2. Server Errors (5xx)

```typescript
// 500 Internal Server Error - Unexpected error
throw new AppError(500, "Error interno del servidor", "INTERNAL_ERROR");

// 503 Service Unavailable - Database down
throw new AppError(503, "Servicio no disponible", "SERVICE_UNAVAILABLE");
```

## Domain-Specific Errors

```typescript
// src/errors/usuarios.errors.ts
import { AppError } from "../middlewares/errorHandler";

export class UsuarioNotFoundError extends AppError {
  constructor(id: number) {
    super(404, `Usuario con ID ${id} no encontrado`, "USUARIO_NOT_FOUND");
  }
}

export class UsuarioInactivoError extends AppError {
  constructor(username: string) {
    super(403, `El usuario ${username} está inactivo`, "USUARIO_INACTIVO");
  }
}

export class DuplicateUsernameError extends AppError {
  constructor(username: string) {
    super(409, `El username "${username}" ya existe`, "DUPLICATE_USERNAME");
  }
}

// Usage
export const obtenerUsuario = async (id: number) => {
  const usuario = await Usuario.findByPk(id);

  if (!usuario) {
    throw new UsuarioNotFoundError(id);
  }

  if (!usuario.activo) {
    throw new UsuarioInactivoError(usuario.username);
  }

  return usuario;
};
```

## Validation Error Handling

```typescript
// src/controllers/usuarios/usuarios.controller.ts
export const createUsuario = async (req: Request, res: Response) => {
  try {
    const usuario = await crearUsuario(req.body);

    res.status(201).json({
      status: "ok",
      message: "Usuario creado correctamente",
      data: usuario
    });
  } catch (error: any) {
    // Handle known errors
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: "error",
        message: error.message,
        code: error.code,
        details: error.details
      });
      return;
    }

    // Handle unexpected errors
    console.error("Error inesperado:", error);
    res.status(500).json({
      status: "error",
      message: "Error al crear usuario",
      error: error.message
    });
  }
};
```

## Graceful Shutdown

```typescript
// src/index.ts
import { Server } from "http";

let server: Server;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    await sequelize.sync({ force: false });
    console.log("Models synchronized");

    server = app.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, starting graceful shutdown...`);

  // Close server (stop accepting new connections)
  server.close(async () => {
    console.log("HTTP server closed");

    try {
      // Close database connections
      await sequelize.close();
      console.log("Database connections closed");

      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
```

## Unhandled Rejection/Exception Handling

```typescript
// src/index.ts

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);

  // Log to error monitoring service (e.g., Sentry)
  // logToSentry(reason);

  // Gracefully shutdown
  shutdown("UNHANDLED_REJECTION");
});

// Catch uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);

  // Log to error monitoring service
  // logToSentry(error);

  // Exit immediately (process is in undefined state)
  process.exit(1);
});
```

## Logging Best Practices

### Structured Logging

```typescript
// src/utils/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },

  error: (message: string, error?: Error, meta?: any) => {
    console.error(JSON.stringify({
      level: "error",
      message,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },

  warn: (message: string, meta?: any) => {
    console.warn(JSON.stringify({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

// Usage
import { logger } from "../utils/logger";

export const crearUsuario = async (data: any) => {
  try {
    logger.info("Creating user", { username: data.username });

    const usuario = await Usuario.create(data);

    logger.info("User created successfully", {
      userId: usuario.id,
      username: usuario.username
    });

    return usuario;
  } catch (error: any) {
    logger.error("Failed to create user", error, {
      username: data.username,
      email: data.email
    });

    throw error;
  }
};
```

### Production Logging (Winston)

```typescript
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
```

## Error Monitoring Integration

### Sentry Integration

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});

// Request handler (FIRST middleware)
app.use(Sentry.Handlers.requestHandler());

// Trace handler
app.use(Sentry.Handlers.tracingHandler());

// ... your routes ...

// Error handler (AFTER routes, BEFORE custom error handler)
app.use(Sentry.Handlers.errorHandler());

// Custom error handler
app.use(errorHandler);
```

## Testing Error Handling

```typescript
describe('Error Handling', () => {
  it('should return 404 for non-existent user', async () => {
    const res = await request(app).get('/v1/usuarios/999');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      status: "error",
      code: "NOT_FOUND"
    });
  });

  it('should return 409 for duplicate username', async () => {
    await createUser({ username: 'john' });

    const res = await request(app)
      .post('/v1/usuarios')
      .send({ username: 'john', email: 'john2@test.com', password: 'Test123!' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("USERNAME_ALREADY_EXISTS");
  });

  it('should handle transaction rollback on error', async () => {
    const initialCount = await Usuario.count();

    try {
      await crearUsuario({ invalid: 'data' });
    } catch (error) {
      // Expected
    }

    const finalCount = await Usuario.count();
    expect(finalCount).toBe(initialCount);
  });
});
```

## Health Check Endpoint

```typescript
// src/v1/routes/health.route.ts
import { Router, Request, Response } from "express";
import { sequelize } from "../../config/db";

const router = Router();

router.get("/health", async (req: Request, res: Response) => {
  try {
    // Check database connection
    await sequelize.authenticate();

    res.status(200).json({
      status: "ok",
      message: "Service is healthy",
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: "connected"
      }
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Service unhealthy",
      error: "Database connection failed",
      code: "DATABASE_UNAVAILABLE"
    });
  }
});

export default router;
```

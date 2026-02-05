# REST API Starter Template

## Quick Start Commands

```bash
# Initialize new project
npm init -y
npm install express sequelize mysql2 jsonwebtoken argon2 zod cors dotenv
npm install -D typescript @types/express @types/node @types/jsonwebtoken @types/cors tsx

# Initialize TypeScript
npx tsc --init
```

## Minimal tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Minimal package.json Scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "npx tsx --watch --env-file=.env src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  }
}
```

## Minimal .env Template

```bash
# Server Configuration
SERVER_HOST=localhost
SERVER_PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=your_database

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=1h

# Optional: Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Minimal index.ts

```typescript
import express, { Request, Response } from "express";
import { sequelize } from "./config/db";
import { SERVER_HOST, SERVER_PORT } from "./config/config";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "API is running",
    version: "1.0.0"
  });
});

app.listen(SERVER_PORT, SERVER_HOST, async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    await sequelize.sync({ force: false });
    console.log("✅ Models synchronized");

    console.log(`🚀 Server running at http://${SERVER_HOST}:${SERVER_PORT}`);
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
});
```

## Minimal config/db.ts

```typescript
import { Sequelize } from "sequelize";
import { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } from "./config";

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});
```

## Minimal config/config.ts

```typescript
import dotenv from "dotenv";
dotenv.config();

export const SERVER_HOST = process.env.SERVER_HOST || "localhost";
export const SERVER_PORT = Number(process.env.SERVER_PORT) || 3000;

export const DB_HOST = process.env.DB_HOST || "localhost";
export const DB_PORT = Number(process.env.DB_PORT) || 3306;
export const DB_USER = process.env.DB_USER!;
export const DB_PASS = process.env.DB_PASS!;
export const DB_NAME = process.env.DB_NAME!;
```

## Minimal config/jwt.ts

```typescript
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "change-this-in-production";
const EXPIRATION = process.env.JWT_EXPIRATION || "1h";

export interface JWTPayload {
  id: number;
  username: string;
  rol: string;
}

export const generarToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, SECRET_KEY, {
    expiresIn: EXPIRATION,
    algorithm: "HS256"
  });
};

export const verificarToken = (token: string): JWTPayload => {
  return jwt.verify(token, SECRET_KEY) as JWTPayload;
};
```

## Directory Structure

```
proyecto/
├── src/
│   ├── config/
│   │   ├── db.ts
│   │   ├── config.ts
│   │   └── jwt.ts
│   ├── models/
│   │   └── usuarios.ts
│   ├── controllers/
│   │   └── usuarios.controller.ts
│   ├── services/
│   │   └── usuarios.service.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   └── validateResource.ts
│   ├── schemas/
│   │   └── usuarios.schema.ts
│   ├── v1/
│   │   └── routes/
│   │       └── usuarios.route.ts
│   └── index.ts
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

## Minimal .gitignore

```
node_modules/
dist/
.env
.env.local
.env.production
*.log
.DS_Store
coverage/
```

## Health Check Endpoint

```typescript
// Add to src/index.ts
app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: "ok",
      database: "connected",
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      error: error.message
    });
  }
});
```

## First Endpoint Example (User Login)

```typescript
// src/v1/routes/usuarios/usuarios.route.ts
import { Router } from "express";
import { login } from "../../controllers/usuarios/usuarios.controller";

const router = Router();

router.post("/login", login);

export default router;

// src/controllers/usuarios/usuarios.controller.ts
import { Request, Response } from "express";
import { generarToken } from "../../config/jwt";
import Usuario from "../../models/usuarios";
import argon2 from "argon2";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario) {
      res.status(401).json({
        status: "error",
        message: "Credenciales inválidas"
      });
      return;
    }

    const passwordValido = await argon2.verify(usuario.password, password);

    if (!passwordValido) {
      res.status(401).json({
        status: "error",
        message: "Credenciales inválidas"
      });
      return;
    }

    const token = generarToken({
      id: usuario.id,
      username: usuario.username,
      rol: "usuario"
    });

    res.json({
      status: "ok",
      message: "Autenticación exitosa",
      data: { token, expiresIn: "1h" }
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error en autenticación",
      error: error.message
    });
  }
};

// Mount in src/index.ts
import usuariosRouter from "./v1/routes/usuarios/usuarios.route";
app.use("/v1/usuarios", usuariosRouter);
```

## Testing Setup

```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

```json
// jest.config.js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts'
  ]
};
```

## First Test Example

```typescript
// src/__tests__/usuarios.test.ts
import request from 'supertest';
import app from '../index';

describe('POST /v1/usuarios/login', () => {
  it('should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/v1/usuarios/login')
      .send({ email: 'wrong@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });
});
```

## Production Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Add helmet.js for security headers
- [ ] Configure CORS properly
- [ ] Set up logging (Winston/Pino)
- [ ] Add monitoring (Sentry/New Relic)
- [ ] Configure PM2 for clustering
- [ ] Set up database backups
- [ ] Add health check endpoints
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up CI/CD pipeline

# Authentication & Role-Based Access Control (RBAC)

## Overview

Complete implementation of JWT-based authentication with flexible many-to-many role system.

## JWT Authentication Flow

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│  Client  │                │  Server  │                │    DB    │
└────┬─────┘                └────┬─────┘                └────┬─────┘
     │                           │                           │
     │  POST /login              │                           │
     │  {email, password}        │                           │
     ├──────────────────────────>│                           │
     │                           │  Find user by email       │
     │                           ├──────────────────────────>│
     │                           │<──────────────────────────┤
     │                           │  Usuario                  │
     │                           │                           │
     │                           │  Verify password          │
     │                           │  (argon2.verify)          │
     │                           │                           │
     │                           │  Load user roles          │
     │                           ├──────────────────────────>│
     │                           │<──────────────────────────┤
     │                           │  [Rol, Rol, ...]          │
     │                           │                           │
     │                           │  Generate JWT             │
     │                           │  sign({id, username})     │
     │                           │                           │
     │<──────────────────────────┤                           │
     │  {token, expiresIn}       │                           │
     │                           │                           │
     │  GET /v1/usuarios         │                           │
     │  Authorization: Bearer TOKEN                          │
     ├──────────────────────────>│                           │
     │                           │  Verify JWT               │
     │                           │  (verificarToken)         │
     │                           │                           │
     │                           │  Check role               │
     │                           │  (verificarRol)           │
     │                           ├──────────────────────────>│
     │                           │<──────────────────────────┤
     │                           │                           │
     │<──────────────────────────┤                           │
     │  {status: "ok", data: [...]}                          │
     │                           │                           │
```

## Database Schema

### Many-to-Many Role System

```sql
CREATE TABLE usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT true,
  mustChangePassword BOOLEAN DEFAULT false,
  ultimo_acceso DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  descripcion VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios_roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  rol_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE KEY unique_usuario_rol (usuario_id, rol_id)
);
```

## Model Associations

```typescript
// src/models/usuarios/associations.ts
import Usuario from "./usuarios";
import Rol from "./roles";
import UsuarioRol from "./usuarios_roles";

// Many-to-Many: Usuario <-> Rol
Usuario.belongsToMany(Rol, {
  through: UsuarioRol,
  foreignKey: "usuario_id",
  otherKey: "rol_id",
  as: "roles"
});

Rol.belongsToMany(Usuario, {
  through: UsuarioRol,
  foreignKey: "rol_id",
  otherKey: "usuario_id",
  as: "usuarios"
});

// One-to-Many: For accessing join table directly
UsuarioRol.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
UsuarioRol.belongsTo(Rol, { foreignKey: "rol_id", as: "rol" });

Usuario.hasMany(UsuarioRol, { foreignKey: "usuario_id", as: "usuario_roles" });
Rol.hasMany(UsuarioRol, { foreignKey: "rol_id", as: "rol_usuarios" });
```

## JWT Configuration

```typescript
// src/config/jwt.ts
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const EXPIRATION = process.env.JWT_EXPIRATION || "1h";

export interface JWTPayload {
  id: number;
  username: string;
  rol: string;  // Backward compatibility (primary role)
  roles?: string[];  // All roles
}

export const generarToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, SECRET_KEY, {
    expiresIn: EXPIRATION,
    algorithm: "HS256"
  });
};

export const verificarToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, SECRET_KEY) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("TOKEN_EXPIRED");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("TOKEN_INVALID");
    }
    throw error;
  }
};
```

## Authentication Middleware

```typescript
// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verificarToken } from '../config/jwt';

export interface AuthRequest extends Request {
  usuario?: {
    id: number;
    username: string;
    rol: string;
    roles?: string[];  // CACHE: Populated by verificarRol
  };
}

export const autenticarToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      status: "error",
      message: "Acceso no autorizado",
      error: "No se proporcionó un token de autenticación. Debes iniciar sesión primero.",
      code: "TOKEN_NOT_PROVIDED"
    });
    return;
  }

  try {
    const payload = verificarToken(token);
    req.usuario = payload;
    next();
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "TOKEN_INVALID";

    res.status(403).json({
      status: "error",
      message: "Token inválido",
      error: errorCode === "TOKEN_EXPIRED"
        ? "El token ha expirado. Por favor, inicia sesión nuevamente."
        : "El token es inválido. Por favor, inicia sesión nuevamente.",
      code: errorCode
    });
    return;
  }
};
```

## Role-Based Authorization Middleware

```typescript
// src/middlewares/auth.middleware.ts
import UsuarioRol from '../models/usuarios/usuarios_roles';
import Rol from '../models/usuarios/roles';

export const verificarRol = (...rolesPermitidos: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.usuario) {
      res.status(401).json({
        status: "error",
        message: "Autenticación requerida",
        error: "Debes estar autenticado para realizar esta acción.",
        code: "AUTHENTICATION_REQUIRED"
      });
      return;
    }

    try {
      // Check if roles are already cached in request (performance optimization)
      if (!req.usuario.roles) {
        // Fetch and cache roles from database
        const rolesAsignados = await UsuarioRol.findAll({
          where: { usuario_id: req.usuario.id },
          include: [{ model: Rol, as: "rol" }]
        });

        req.usuario.roles = rolesAsignados.map((ur: any) => ur.rol.nombre);
      }

      // Check if user has ANY of the required roles
      const tienePermiso = (req.usuario.roles || []).some((rol) =>
        rolesPermitidos.includes(rol)
      );

      if (!tienePermiso) {
        // Detect operation from route for better error message
        const accion = obtenerAccionDeRuta(req);
        const rolesRequeridos = formatearRoles(rolesPermitidos);

        res.status(403).json({
          status: "error",
          message: "Permisos insuficientes",
          error: `La operación "${accion}" requiere el rol: ${rolesRequeridos}.`,
          detalles: {
            rolesRequeridos: rolesPermitidos,
            usuario: req.usuario.username,
            operacion: accion
          },
          code: "INSUFFICIENT_PERMISSIONS"
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Error verificando roles:", error);
      res.status(500).json({
        status: "error",
        message: "Error verificando permisos",
        error: "Ocurrió un error al verificar los permisos del usuario",
        code: "ROLE_VERIFICATION_ERROR"
      });
      return;
    }
  };
};

// Helper: Extract operation name from request
function obtenerAccionDeRuta(req: Request): string {
  const metodo = req.method;
  const ruta = req.route?.path || req.path;

  // Custom messages for specific routes
  if (ruta.includes('/usuarios')) {
    if (metodo === 'GET' && !ruta.includes(':id')) return 'Listar usuarios';
    if (metodo === 'GET' && ruta.includes(':id')) return 'Ver detalles de usuario';
    if (metodo === 'POST') return 'Crear nuevos usuarios';
    if (metodo === 'PUT') return 'Actualizar usuarios';
    if (metodo === 'DELETE') return 'Eliminar usuarios';
    if (metodo === 'PATCH' && ruta.includes('habilitar')) return 'Habilitar/inhabilitar usuarios';
  }

  // Generic fallback
  const accionMap: { [key: string]: string } = {
    'GET': 'Ver este recurso',
    'POST': 'Crear este recurso',
    'PUT': 'Actualizar este recurso',
    'DELETE': 'Eliminar este recurso',
    'PATCH': 'Modificar este recurso'
  };

  return accionMap[metodo] || 'Esta operación';
}

// Helper: Format role list for error messages
function formatearRoles(roles: string[]): string {
  if (roles.length === 1) return `"${roles[0]}"`;
  if (roles.length === 2) return `"${roles[0]}" o "${roles[1]}"`;

  const ultimoRol = roles[roles.length - 1];
  const rolesAnteriores = roles.slice(0, -1).map(r => `"${r}"`).join(', ');
  return `${rolesAnteriores} o "${ultimoRol}"`;
}
```

## Login Controller

```typescript
// src/controllers/usuarios/usuarios.controller.ts
import argon2 from "argon2";
import { generarToken } from "../../config/jwt";
import Usuario from "../../models/usuarios/usuarios";
import UsuarioRol from "../../models/usuarios/usuarios_roles";
import Rol from "../../models/usuarios/roles";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    // Find user by email OR username
    const usuario = await Usuario.findOne({
      where: email ? { email } : { username }
    });

    if (!usuario) {
      res.status(401).json({
        status: "error",
        message: "Credenciales inválidas",
        error: "Usuario o contraseña incorrectos",
        code: "INVALID_CREDENTIALS"
      });
      return;
    }

    // Check if user is active
    if (!usuario.activo) {
      res.status(403).json({
        status: "error",
        message: "Cuenta deshabilitada",
        error: "Tu cuenta ha sido deshabilitada. Contacta al administrador.",
        code: "ACCOUNT_DISABLED"
      });
      return;
    }

    // Verify password
    const passwordValido = await argon2.verify(usuario.password, password);

    if (!passwordValido) {
      res.status(401).json({
        status: "error",
        message: "Credenciales inválidas",
        error: "Usuario o contraseña incorrectos",
        code: "INVALID_CREDENTIALS"
      });
      return;
    }

    // Load user roles
    const rolesAsignados = await UsuarioRol.findAll({
      where: { usuario_id: usuario.id },
      include: [{ model: Rol, as: "rol" }]
    });

    const roles = rolesAsignados.map((ur: any) => ur.rol.nombre);
    const rolPrincipal = roles[0] || "usuario";  // Fallback

    // Generate JWT
    const token = generarToken({
      id: usuario.id,
      username: usuario.username,
      rol: rolPrincipal,  // Backward compatibility
      roles  // All roles
    });

    // Update last access
    usuario.ultimo_acceso = new Date();
    await usuario.save();

    res.status(200).json({
      status: "ok",
      message: "Autenticación exitosa",
      data: {
        token,
        expiresIn: "1h",
        usuario: {
          id: usuario.id,
          username: usuario.username,
          email: usuario.email,
          roles,
          mustChangePassword: usuario.mustChangePassword
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error en autenticación",
      error: error.message
    });
  }
};
```

## Role Management Service

```typescript
// src/services/usuarios/usuarios_roles.service.ts
import { sequelize } from "../../config/db";
import UsuarioRol from "../../models/usuarios/usuarios_roles";
import Usuario from "../../models/usuarios/usuarios";
import Rol from "../../models/usuarios/roles";

// Assign single role to user
export const asignarRol = async (usuario_id: number, rol_id: number) => {
  // Check if already assigned
  const existe = await UsuarioRol.findOne({
    where: { usuario_id, rol_id }
  });

  if (existe) {
    throw new Error("El usuario ya tiene este rol asignado");
  }

  return await UsuarioRol.create({ usuario_id, rol_id });
};

// Remove single role from user
export const removerRol = async (usuario_id: number, rol_id: number) => {
  const deleted = await UsuarioRol.destroy({
    where: { usuario_id, rol_id }
  });

  if (deleted === 0) {
    throw new Error("El usuario no tiene este rol asignado");
  }

  return deleted;
};

// Synchronize user roles (replace all)
export const sincronizarRoles = async (usuario_id: number, roles_ids: number[]) => {
  const transaction = await sequelize.transaction();

  try {
    // Validate user exists
    const usuario = await Usuario.findByPk(usuario_id, { transaction });
    if (!usuario) throw new Error("Usuario no encontrado");

    // Validate all roles exist
    const roles = await Rol.findAll({
      where: { id: roles_ids },
      transaction
    });

    if (roles.length !== roles_ids.length) {
      throw new Error("Uno o más roles no existen");
    }

    // Remove all current roles
    await UsuarioRol.destroy({
      where: { usuario_id },
      transaction
    });

    // Assign new roles
    const nuevasAsignaciones = roles_ids.map(rol_id => ({
      usuario_id,
      rol_id
    }));

    const created = await UsuarioRol.bulkCreate(nuevasAsignaciones, {
      transaction
    });

    await transaction.commit();
    return created;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Get all roles for a user
export const obtenerRolesDeUsuario = async (usuario_id: number, opts: any = {}) => {
  const include: any[] = [];

  if (opts.include?.includes("usuario")) {
    include.push({ model: Usuario, as: "usuario", attributes: { exclude: ["password"] } });
  }

  if (opts.include?.includes("rol")) {
    include.push({ model: Rol, as: "rol" });
  }

  return await UsuarioRol.findAll({
    where: { usuario_id },
    include
  });
};
```

## Route Protection Patterns

```typescript
// src/v1/routes/usuarios/usuarios.route.ts
import { Router } from "express";
import { autenticarToken, verificarRol } from "../../middlewares/auth.middleware";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../../controllers/usuarios/usuarios.controller";

const router = Router();

// Public routes
router.post("/login", login);  // No authentication required

// Protected routes (requires authentication)
router.use(autenticarToken);  // Apply to all routes below

// Admin-only routes
router.get("/", verificarRol("admin"), getUsuarios);
router.post("/", verificarRol("admin"), createUsuario);
router.put("/:id", verificarRol("admin"), updateUsuario);
router.delete("/:id", verificarRol("admin"), deleteUsuario);

// Multiple roles allowed (admin OR gerente)
router.get("/reportes", verificarRol("admin", "gerente"), getReportes);

export default router;
```

## Security Best Practices

### 1. Password Hashing with Argon2

```typescript
import argon2 from "argon2";

// Hash password before storing
const hashedPassword = await argon2.hash(password, {
  type: argon2.argon2id,  // Recommended variant
  memoryCost: 65536,      // 64 MB
  timeCost: 3,            // 3 iterations
  parallelism: 4          // 4 parallel threads
});

// Verify password
const isValid = await argon2.verify(hashedPassword, password);
```

**Why Argon2?**
- Winner of Password Hashing Competition (2015)
- Resistant to GPU/ASIC attacks
- Configurable memory and CPU cost
- Better than bcrypt/scrypt

### 2. JWT Security

```typescript
// ✅ DO:
- Use strong secret keys (min 256 bits)
- Set appropriate expiration (1h-24h)
- Store JWT in httpOnly cookies (not localStorage)
- Validate JWT on every request
- Include minimal data in payload

// ❌ DON'T:
- Store sensitive data in JWT (e.g., password)
- Use weak secrets
- Set very long expiration (>7 days)
- Trust JWT without verification
```

### 3. Rate Limiting (Recommended)

```typescript
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // Max 5 attempts
  message: {
    status: "error",
    message: "Demasiados intentos de inicio de sesión",
    error: "Por favor, intenta nuevamente en 15 minutos"
  }
});

router.post("/login", loginLimiter, login);
```

### 4. HTTPS Only (Production)

```typescript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

## Testing Authentication

```typescript
describe('Authentication', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/v1/usuarios');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_NOT_PROVIDED');
  });

  it('should return 403 with invalid token', async () => {
    const res = await request(app)
      .get('/v1/usuarios')
      .set('Authorization', 'Bearer invalid_token');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('should allow access with valid token and role', async () => {
    const token = generarToken({ id: 1, username: 'admin', rol: 'admin' });
    const res = await request(app)
      .get('/v1/usuarios')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny access without required role', async () => {
    const token = generarToken({ id: 2, username: 'vendedor', rol: 'vendedor' });
    const res = await request(app)
      .get('/v1/usuarios')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});
```

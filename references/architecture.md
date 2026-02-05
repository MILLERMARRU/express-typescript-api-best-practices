# Architecture Deep Dive

## Layered Architecture Pattern

### Layer Flow

```
┌─────────────────────────────────────────────────────────┐
│                      HTTP Request                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  ROUTES LAYER (v1/routes/)                              │
│  - Define endpoints                                     │
│  - Apply middleware (auth, validation)                  │
│  - Route to controllers                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  MIDDLEWARE LAYER                                       │
│  - autenticarToken: Verify JWT                         │
│  - verificarRol: Check permissions                     │
│  - validate: Zod validation                            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  CONTROLLERS LAYER (controllers/)                       │
│  - Extract request data                                 │
│  - Call service functions                               │
│  - Format responses                                     │
│  - Handle HTTP errors                                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  SERVICES LAYER (services/)                             │
│  - Business logic                                       │
│  - Transaction management                               │
│  - Data validation                                      │
│  - Orchestrate multiple models                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  MODELS LAYER (models/)                                 │
│  - Sequelize model definitions                          │
│  - Database schema                                      │
│  - Model associations                                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   DATABASE (MySQL)                       │
└─────────────────────────────────────────────────────────┘
```

## Complete Example: User Creation Flow

### 1. Route Definition

```typescript
// src/v1/routes/usuarios/usuarios.route.ts
import { Router } from "express";
import { createUsuario } from "../../controllers/usuarios/usuarios.controller";
import { autenticarToken, verificarRol } from "../../middlewares/auth.middleware";
import validate from "../../middlewares/validateResource";
import { createUsuarioSchema } from "../../schemas/usuarios.schema";

const router = Router();

router.post(
  "/",
  autenticarToken,                      // 1. Verify JWT
  verificarRol("admin"),                // 2. Check role
  validate(createUsuarioSchema),        // 3. Validate input
  createUsuario                         // 4. Execute controller
);

export default router;
```

### 2. Schema Definition

```typescript
// src/schemas/usuarios.schema.ts
import { z } from "zod";

export const createUsuarioSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, "Username debe tener al menos 3 caracteres")
      .max(50, "Username no puede exceder 50 caracteres")
      .regex(/^[a-zA-Z0-9._-]+$/, "Username solo permite letras, números, puntos, guiones"),

    email: z.string()
      .email("Email inválido")
      .max(100)
      .transform(val => val.toLowerCase()),

    password: z.string()
      .min(8, "Contraseña debe tener al menos 8 caracteres")
      .max(100)
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[a-z]/, "Debe contener al menos una minúscula")
      .regex(/[0-9]/, "Debe contener al menos un número"),

    rol_id: z.number().int().positive().optional(),
    mustChangePassword: z.boolean().default(false)
  })
});

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>["body"];
```

### 3. Controller Implementation

```typescript
// src/controllers/usuarios/usuarios.controller.ts
import { Request, Response } from "express";
import { crearUsuario, obtenerUsuarios } from "../../services/usuarios/usuarios.service";

export const createUsuario = async (req: Request, res: Response) => {
  try {
    const usuario = await crearUsuario(req.body);

    res.status(201).json({
      status: "ok",
      message: "Usuario creado correctamente",
      data: usuario
    });
  } catch (error: any) {
    // Handle specific errors
    if (error.message.includes("ya existe")) {
      res.status(400).json({
        status: "error",
        message: "Error de validación",
        error: error.message
      });
      return;
    }

    res.status(500).json({
      status: "error",
      message: "Error al crear usuario",
      error: error.message
    });
  }
};

export const getUsuarios = async (req: Request, res: Response) => {
  try {
    const includeList = construirInclusions(req.query.include as string);
    const usuarios = await obtenerUsuarios({ include: includeList });

    res.status(200).json({
      status: "ok",
      message: "Usuarios obtenidos correctamente",
      data: usuarios
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
};

// Helper function
function construirInclusions(include: string) {
  return String(include || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
```

### 4. Service Implementation

```typescript
// src/services/usuarios/usuarios.service.ts
import { sequelize } from "../../config/db";
import Usuario from "../../models/usuarios/usuarios";
import Rol from "../../models/usuarios/roles";
import UsuarioRol from "../../models/usuarios/usuarios_roles";
import argon2 from "argon2";

type Opts = {
  include?: string[];
}

const construirInclusions = (opts: Opts = {}): any[] => {
  const include: any[] = [];

  if (opts.include?.includes("roles")) {
    include.push({
      model: Rol,
      as: "roles",
      through: { attributes: [] }  // Hide join table in response
    });
  }

  return include;
};

export const obtenerUsuarios = async (opts: Opts = {}) => {
  const include = construirInclusions(opts);
  return await Usuario.findAll({
    include,
    order: [["id", "ASC"]],
    attributes: { exclude: ["password"] }  // Never return passwords
  });
};

export const crearUsuario = async (usuarioData: any) => {
  const transaction = await sequelize.transaction();

  try {
    // 1. Validate uniqueness
    const existeUsername = await Usuario.findOne({
      where: { username: usuarioData.username },
      transaction
    });

    if (existeUsername) {
      throw new Error(`El username "${usuarioData.username}" ya existe`);
    }

    const existeEmail = await Usuario.findOne({
      where: { email: usuarioData.email },
      transaction
    });

    if (existeEmail) {
      throw new Error(`El email "${usuarioData.email}" ya está en uso`);
    }

    // 2. Hash password
    const hashedPassword = await argon2.hash(usuarioData.password);

    // 3. Create user
    const usuario = await Usuario.create({
      username: usuarioData.username,
      email: usuarioData.email,
      password: hashedPassword,
      mustChangePassword: usuarioData.mustChangePassword ?? false,
      activo: true
    }, { transaction });

    // 4. Assign default role if not specified
    const rolId = usuarioData.rol_id ?? 2; // Default: vendedor

    await UsuarioRol.create({
      usuario_id: usuario.id,
      rol_id: rolId
    }, { transaction });

    await transaction.commit();

    // 5. Return user without password
    const { password, ...usuarioSinPassword } = usuario.toJSON();
    return usuarioSinPassword;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const actualizarUsuario = async (id: string, usuarioData: any) => {
  const transaction = await sequelize.transaction();

  try {
    const usuario = await Usuario.findByPk(id, { transaction });

    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    // Check uniqueness if changing username/email
    if (usuarioData.username && usuarioData.username !== usuario.username) {
      const existe = await Usuario.findOne({
        where: { username: usuarioData.username },
        transaction
      });
      if (existe) throw new Error("Username ya existe");
    }

    if (usuarioData.email && usuarioData.email !== usuario.email) {
      const existe = await Usuario.findOne({
        where: { email: usuarioData.email },
        transaction
      });
      if (existe) throw new Error("Email ya está en uso");
    }

    // Hash password if provided
    if (usuarioData.password) {
      usuarioData.password = await argon2.hash(usuarioData.password);
    }

    await usuario.update(usuarioData, { transaction });
    await transaction.commit();

    const { password, ...usuarioSinPassword } = usuario.toJSON();
    return usuarioSinPassword;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
```

### 5. Model Definition

```typescript
// src/models/usuarios/usuarios.ts
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config/db";

class Usuario extends Model {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public activo!: boolean;
  public mustChangePassword!: boolean;
  public ultimo_acceso!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Usuario.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    ultimo_acceso: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: "usuarios",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

export default Usuario;
```

## Dependency Injection Pattern (Advanced)

For larger projects, consider dependency injection:

```typescript
// src/services/usuarios/usuarios.service.ts
export class UsuarioService {
  constructor(
    private usuarioRepository: typeof Usuario,
    private rolRepository: typeof Rol,
    private usuarioRolRepository: typeof UsuarioRol
  ) {}

  async crearUsuario(data: CreateUsuarioInput) {
    // Implementation using this.usuarioRepository
  }
}

// Usage
const usuarioService = new UsuarioService(Usuario, Rol, UsuarioRol);
```

Benefits:
- Easier testing (mock repositories)
- Better testability
- Follows Dependency Inversion Principle

## Repository Pattern (Advanced)

Abstract database operations:

```typescript
// src/repositories/usuario.repository.ts
export class UsuarioRepository {
  async findByUsername(username: string) {
    return await Usuario.findOne({ where: { username } });
  }

  async findByEmail(email: string) {
    return await Usuario.findOne({ where: { email } });
  }

  async create(data: any, transaction?: Transaction) {
    return await Usuario.create(data, { transaction });
  }
}

// Service uses repository
export class UsuarioService {
  constructor(private usuarioRepo: UsuarioRepository) {}

  async crearUsuario(data: any) {
    const existe = await this.usuarioRepo.findByUsername(data.username);
    if (existe) throw new Error("Username ya existe");
    // ...
  }
}
```

Benefits:
- Centralize database queries
- Easier to swap ORM (Sequelize → TypeORM)
- Better testability

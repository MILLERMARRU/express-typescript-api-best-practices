# Input Validation with Zod

## Why Zod?

- **Type-safe:** Infers TypeScript types from schemas
- **Composable:** Reuse and combine schemas
- **Detailed errors:** User-friendly error messages
- **Runtime validation:** Catches invalid data at runtime
- **Zero dependencies:** Lightweight and fast

## Basic Schema Definition

```typescript
// src/schemas/usuarios.schema.ts
import { z } from "zod";

export const createUsuarioSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, "Username debe tener al menos 3 caracteres")
      .max(50, "Username no puede exceder 50 caracteres")
      .regex(/^[a-zA-Z0-9._-]+$/, "Username solo permite letras, números, puntos, guiones y guion bajo"),

    email: z.string()
      .email("Email inválido")
      .max(100)
      .transform(val => val.toLowerCase()),  // Normalize

    password: z.string()
      .min(8, "Contraseña debe tener al menos 8 caracteres")
      .max(100)
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[a-z]/, "Debe contener al menos una minúscula")
      .regex(/[0-9]/, "Debe contener al menos un número")
      .regex(/[!@#$%^&*]/, "Debe contener al menos un carácter especial (!@#$%^&*)"),

    rol_id: z.number()
      .int("Rol ID debe ser un número entero")
      .positive("Rol ID debe ser positivo")
      .optional(),

    mustChangePassword: z.boolean()
      .default(false)
  }),

  params: z.object({}),

  query: z.object({})
});

// Infer TypeScript type from schema
export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>["body"];
```

## Validation Middleware

```typescript
// src/middlewares/validateResource.ts
import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodError } from "zod";

const validate = (schema: ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      if (!result.success) {
        const formattedErrors = result.error.issues.map((error) => ({
          field: error.path[1] || error.path[0],  // Get field name
          message: error.message,
          code: error.code
        }));

        res.status(400).json({
          status: "error",
          message: "Error de validación",
          errors: formattedErrors
        });
        return;
      }

      // Replace request data with validated (and transformed) data
      if (result.data.body) req.body = result.data.body;
      if (result.data.query) req.query = result.data.query as any;
      if (result.data.params) req.params = result.data.params as any;

      next();
    } catch (error) {
      console.error("Error en middleware de validación:", error);
      res.status(500).json({
        status: "error",
        message: "Error interno en validación",
        detalle: error
      });
      return;
    }
  };
};

export default validate;
```

## Usage in Routes

```typescript
// src/v1/routes/usuarios/usuarios.route.ts
import validate from "../../middlewares/validateResource";
import { createUsuarioSchema, updateUsuarioSchema } from "../../schemas/usuarios.schema";

router.post("/", validate(createUsuarioSchema), createUsuario);
router.put("/:id", validate(updateUsuarioSchema), updateUsuario);
```

## Advanced Validation Patterns

### 1. Conditional Validation

```typescript
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    password: z.string().min(8)
  }).refine(
    (data) => data.email || data.username,
    { message: "Debes proporcionar email o username" }
  )
});
```

### 2. Custom Validators

```typescript
const isValidCUIT = (cuit: string): boolean => {
  // Custom validation logic
  return /^\d{2}-\d{8}-\d{1}$/.test(cuit);
};

export const proveedorSchema = z.object({
  body: z.object({
    nombre: z.string().min(3),
    cuit: z.string().refine(isValidCUIT, {
      message: "CUIT inválido. Formato: XX-XXXXXXXX-X"
    })
  })
});
```

### 3. Nested Objects

```typescript
export const createVentaSchema = z.object({
  body: z.object({
    vendedor_id: z.number().int().positive(),
    fecha: z.string().datetime().optional(),

    detalles: z.array(
      z.object({
        producto_id: z.number().int().positive(),
        cantidad: z.number().int().positive().min(1),
        precio_unitario: z.number().positive().optional(),
        almacen_id: z.number().int().positive()
      })
    ).min(1, "La venta debe tener al menos un detalle")
  })
});
```

### 4. Transform and Sanitize

```typescript
export const productoSchema = z.object({
  body: z.object({
    nombre: z.string()
      .min(3)
      .transform(val => val.trim())  // Remove whitespace
      .transform(val => val.charAt(0).toUpperCase() + val.slice(1)),  // Capitalize

    precio: z.string()
      .or(z.number())
      .transform(val => Number(val))  // Convert to number
      .pipe(z.number().positive()),  // Validate as number

    descripcion: z.string()
      .optional()
      .transform(val => val ? val.trim() : undefined)  // Sanitize
  })
});
```

### 5. Date Validation

```typescript
export const ventaSchema = z.object({
  body: z.object({
    fecha: z.string()
      .datetime()
      .or(z.date())
      .transform(val => new Date(val)),

    fecha_entrega: z.string()
      .datetime()
      .optional()
      .refine((val) => {
        if (!val) return true;
        return new Date(val) > new Date();
      }, { message: "La fecha de entrega debe ser futura" })
  })
});
```

### 6. File Upload Validation

```typescript
export const uploadSchema = z.object({
  file: z.object({
    mimetype: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ], { errorMap: () => ({ message: "Tipo de archivo no permitido" }) }),

    size: z.number()
      .max(5 * 1024 * 1024, "El archivo no puede exceder 5MB")
  })
});
```

## Schema Composition

### Reusable Schemas

```typescript
// Base schemas
const idSchema = z.number().int().positive();
const emailSchema = z.string().email().max(100).transform(v => v.toLowerCase());
const usernameSchema = z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/);

// Compose schemas
export const createUsuarioSchema = z.object({
  body: z.object({
    username: usernameSchema,
    email: emailSchema,
    password: z.string().min(8).max(100),
    rol_id: idSchema.optional()
  })
});

export const updateUsuarioSchema = z.object({
  body: z.object({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    password: z.string().min(8).max(100).optional()
  }),
  params: z.object({
    id: idSchema
  })
});
```

### Extending Schemas

```typescript
const baseUsuarioSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email()
});

// Extend for creation
export const createUsuarioSchema = z.object({
  body: baseUsuarioSchema.extend({
    password: z.string().min(8)
  })
});

// Partial for updates
export const updateUsuarioSchema = z.object({
  body: baseUsuarioSchema.partial(),
  params: z.object({ id: z.number() })
});
```

## Query Parameter Validation

```typescript
export const listarUsuariosSchema = z.object({
  query: z.object({
    page: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().positive())
      .default("1"),

    limit: z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().positive().max(100))
      .default("10"),

    include: z.string()
      .optional()
      .transform(val => val ? val.split(',').map(s => s.trim()) : []),

    activo: z.enum(["true", "false"])
      .transform(val => val === "true")
      .optional()
  })
});
```

## Error Handling

### Formatted Error Response

```typescript
const validate = (schema: ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      if (!result.success) {
        const formattedErrors = formatZodErrors(result.error);

        res.status(400).json({
          status: "error",
          message: "Error de validación",
          errors: formattedErrors
        });
        return;
      }

      // ... rest of middleware
    } catch (error) {
      // Handle unexpected errors
    }
  };
};

function formatZodErrors(error: ZodError) {
  return error.issues.map((issue) => {
    const field = issue.path[1] || issue.path[0];

    // Custom messages based on error code
    let message = issue.message;

    if (issue.code === "invalid_type") {
      message = `${field} debe ser de tipo ${issue.expected}`;
    } else if (issue.code === "too_small") {
      if (issue.type === "string") {
        message = `${field} debe tener al menos ${issue.minimum} caracteres`;
      } else if (issue.type === "number") {
        message = `${field} debe ser mayor o igual a ${issue.minimum}`;
      }
    } else if (issue.code === "too_big") {
      if (issue.type === "string") {
        message = `${field} no puede exceder ${issue.maximum} caracteres`;
      } else if (issue.type === "number") {
        message = `${field} no puede ser mayor a ${issue.maximum}`;
      }
    }

    return {
      field: String(field),
      message,
      code: issue.code
    };
  });
}
```

## Testing Validation

```typescript
describe('Validation', () => {
  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/v1/usuarios')
      .send({ email: 'invalid-email', password: 'Test123!' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual({
      field: 'email',
      message: 'Email inválido',
      code: 'invalid_string'
    });
  });

  it('should accept valid data', async () => {
    const res = await request(app)
      .post('/v1/usuarios')
      .send({
        username: 'john.doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      });

    expect(res.status).toBe(201);
  });

  it('should transform email to lowercase', async () => {
    const res = await request(app)
      .post('/v1/usuarios')
      .send({
        username: 'jane',
        email: 'JANE@EXAMPLE.COM',
        password: 'SecurePass123!'
      });

    expect(res.body.data.email).toBe('jane@example.com');
  });
});
```

## Performance Considerations

### 1. Cache Parsed Schemas

```typescript
// ✅ GOOD: Define schema once
const userSchema = z.object({ /* ... */ });

router.post("/", validate(userSchema), createUsuario);

// ❌ BAD: Create schema on every request
router.post("/", validate(z.object({ /* ... */ })), createUsuario);
```

### 2. Async vs Sync Parsing

```typescript
// For simple schemas (no async transforms)
const result = schema.safeParse(data);  // Faster

// For async transforms
const result = await schema.safeParseAsync(data);  // Necessary
```

### 3. Selective Validation

```typescript
// Only validate what you need
export const partialUpdateSchema = z.object({
  body: baseSchema.partial()  // All fields optional
});

// Or use pick/omit
export const updatePasswordSchema = z.object({
  body: baseSchema.pick({ password: true })  // Only password field
});
```

## Integration with TypeScript

```typescript
// Define schema
export const createProductoSchema = z.object({
  body: z.object({
    nombre: z.string().min(3),
    precio: z.number().positive(),
    stock: z.number().int().nonnegative()
  })
});

// Extract TypeScript type
export type CreateProductoInput = z.infer<typeof createProductoSchema>["body"];

// Use in service with type safety
export const crearProducto = async (data: CreateProductoInput) => {
  // data is fully typed!
  return await Producto.create({
    nombre: data.nombre,  // TypeScript knows this exists
    precio: data.precio,
    stock: data.stock
  });
};

// Controller is also type-safe
export const createProducto = async (req: Request, res: Response) => {
  const producto = await crearProducto(req.body);  // req.body is validated
  res.json({ data: producto });
};
```

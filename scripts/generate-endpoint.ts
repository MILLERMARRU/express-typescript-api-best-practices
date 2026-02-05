#!/usr/bin/env node
/**
 * Generate REST API Endpoint Scaffold
 *
 * Usage:
 *   npx tsx scripts/generate-endpoint.ts <entityName>
 *   npx tsx scripts/generate-endpoint.ts Usuario
 *
 * Generates:
 *   - Model (src/models/<entityName>.ts)
 *   - Service (src/services/<entityName>.service.ts)
 *   - Controller (src/controllers/<entityName>.controller.ts)
 *   - Route (src/v1/routes/<entityName>.route.ts)
 *   - Schema (src/schemas/<entityName>.schema.ts)
 */

import * as fs from 'fs';
import * as path from 'path';

interface GeneratorOptions {
  entityName: string;
  entityNameLower: string;
  entityNamePlural: string;
  fields: { name: string; type: string }[];
}

const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const pluralize = (str: string): string => {
  // Simple pluralization (extend as needed)
  if (str.endsWith('s')) return str;
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  return str + 's';
};

const generateModel = (opts: GeneratorOptions): string => {
  return `import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db";

class ${opts.entityName} extends Model {
  public id!: number;
  // TODO: Add your fields here
  public nombre!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

${opts.entityName}.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // TODO: Define your fields
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: "${opts.entityNameLower}s",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

export default ${opts.entityName};
`;
};

const generateService = (opts: GeneratorOptions): string => {
  return `import { sequelize } from "../../config/db";
import ${opts.entityName} from "../../models/${opts.entityNameLower}";

type Opts = {
  include?: string[];
}

// Build Sequelize includes dynamically
const construirInclusions = (opts: Opts = {}): any[] => {
  const include: any[] = [];

  // TODO: Add your relations
  // if (opts.include?.includes("relacion")) {
  //   include.push({ model: RelacionModel, as: "relacion" });
  // }

  return include;
};

// Get all ${opts.entityNamePlural}
export const obtener${opts.entityNamePlural} = async (opts: Opts = {}) => {
  const include = construirInclusions(opts);
  return await ${opts.entityName}.findAll({
    include,
    order: [["id", "ASC"]]
  });
};

// Get ${opts.entityName} by ID
export const obtener${opts.entityName}PorId = async (id: string, opts: Opts = {}) => {
  const include = construirInclusions(opts);
  return await ${opts.entityName}.findByPk(id, { include });
};

// Create ${opts.entityName}
export const crear${opts.entityName} = async (data: any) => {
  const transaction = await sequelize.transaction();

  try {
    // TODO: Add validation
    const ${opts.entityNameLower} = await ${opts.entityName}.create(data, { transaction });

    await transaction.commit();
    return ${opts.entityNameLower};
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Update ${opts.entityName}
export const actualizar${opts.entityName} = async (id: string, data: any) => {
  const transaction = await sequelize.transaction();

  try {
    const ${opts.entityNameLower} = await ${opts.entityName}.findByPk(id, { transaction });

    if (!${opts.entityNameLower}) {
      throw new Error("${opts.entityName} no encontrado");
    }

    await ${opts.entityNameLower}.update(data, { transaction });

    await transaction.commit();
    return ${opts.entityNameLower};
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Delete ${opts.entityName}
export const eliminar${opts.entityName} = async (id: string) => {
  return await ${opts.entityName}.destroy({ where: { id } });
};
`;
};

const generateController = (opts: GeneratorOptions): string => {
  return `import { Request, Response } from "express";
import {
  obtener${opts.entityNamePlural},
  obtener${opts.entityName}PorId,
  crear${opts.entityName},
  actualizar${opts.entityName},
  eliminar${opts.entityName}
} from "../../services/${opts.entityNameLower}/${opts.entityNameLower}.service";

// Helper to parse include query param
function construirInclusions(include: string) {
  return String(include || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

// Get all ${opts.entityNamePlural}
export const get${opts.entityNamePlural} = async (req: Request, res: Response) => {
  try {
    const includeList = construirInclusions(req.query.include as string);
    const ${opts.entityNameLower}s = await obtener${opts.entityNamePlural}({ include: includeList });

    res.status(200).json({
      status: "ok",
      message: "${opts.entityNamePlural} obtenidos correctamente",
      data: ${opts.entityNameLower}s
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error al obtener ${opts.entityNamePlural}",
      error: error.message
    });
  }
};

// Get ${opts.entityName} by ID
export const get${opts.entityName}ById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const includeList = construirInclusions(req.query.include as string);
    const ${opts.entityNameLower} = await obtener${opts.entityName}PorId(id, { include: includeList });

    if (!${opts.entityNameLower}) {
      res.status(404).json({
        status: "error",
        message: "${opts.entityName} no encontrado"
      });
      return;
    }

    res.status(200).json({
      status: "ok",
      message: "${opts.entityName} obtenido correctamente",
      data: ${opts.entityNameLower}
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error al obtener ${opts.entityName}",
      error: error.message
    });
  }
};

// Create ${opts.entityName}
export const create${opts.entityName} = async (req: Request, res: Response) => {
  try {
    const ${opts.entityNameLower} = await crear${opts.entityName}(req.body);

    res.status(201).json({
      status: "ok",
      message: "${opts.entityName} creado correctamente",
      data: ${opts.entityNameLower}
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error al crear ${opts.entityName}",
      error: error.message
    });
  }
};

// Update ${opts.entityName}
export const update${opts.entityName} = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ${opts.entityNameLower} = await actualizar${opts.entityName}(id, req.body);

    res.status(200).json({
      status: "ok",
      message: "${opts.entityName} actualizado correctamente",
      data: ${opts.entityNameLower}
    });
  } catch (error: any) {
    if (error.message.includes("no encontrado")) {
      res.status(404).json({
        status: "error",
        message: error.message
      });
      return;
    }

    res.status(500).json({
      status: "error",
      message: "Error al actualizar ${opts.entityName}",
      error: error.message
    });
  }
};

// Delete ${opts.entityName}
export const delete${opts.entityName} = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await eliminar${opts.entityName}(id);

    if (!deleted) {
      res.status(404).json({
        status: "error",
        message: "${opts.entityName} no encontrado"
      });
      return;
    }

    res.status(200).json({
      status: "ok",
      message: "${opts.entityName} eliminado correctamente"
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Error al eliminar ${opts.entityName}",
      error: error.message
    });
  }
};
`;
};

const generateRoute = (opts: GeneratorOptions): string => {
  return `import { Router } from "express";
import {
  get${opts.entityNamePlural},
  get${opts.entityName}ById,
  create${opts.entityName},
  update${opts.entityName},
  delete${opts.entityName}
} from "../../controllers/${opts.entityNameLower}/${opts.entityNameLower}.controller";
// import { autenticarToken, verificarRol } from "../../middlewares/auth.middleware";
// import validate from "../../middlewares/validateResource";
// import { create${opts.entityName}Schema, update${opts.entityName}Schema } from "../../schemas/${opts.entityNameLower}.schema";

const router = Router();

export default router
  .get("/", get${opts.entityNamePlural})
  .get("/:id", get${opts.entityName}ById)
  .post("/", create${opts.entityName})
  .put("/:id", update${opts.entityName})
  .delete("/:id", delete${opts.entityName});

// TODO: Add authentication and validation
// .post("/", autenticarToken, verificarRol("admin"), validate(create${opts.entityName}Schema), create${opts.entityName})
`;
};

const generateSchema = (opts: GeneratorOptions): string => {
  return `import { z } from "zod";

export const create${opts.entityName}Schema = z.object({
  body: z.object({
    // TODO: Define your validation schema
    nombre: z.string()
      .min(3, "Nombre debe tener al menos 3 caracteres")
      .max(100, "Nombre no puede exceder 100 caracteres")
  }),
  params: z.object({}),
  query: z.object({})
});

export const update${opts.entityName}Schema = z.object({
  body: z.object({
    nombre: z.string()
      .min(3)
      .max(100)
      .optional()
  }),
  params: z.object({
    id: z.string().regex(/^\\d+$/).transform(Number)
  }),
  query: z.object({})
});

export type Create${opts.entityName}Input = z.infer<typeof create${opts.entityName}Schema>["body"];
export type Update${opts.entityName}Input = z.infer<typeof update${opts.entityName}Schema>["body"];
`;
};

// Main execution
const main = () => {
  const entityName = process.argv[2];

  if (!entityName) {
    console.error("❌ Error: Please provide an entity name");
    console.log("Usage: npx tsx scripts/generate-endpoint.ts <EntityName>");
    console.log("Example: npx tsx scripts/generate-endpoint.ts Usuario");
    process.exit(1);
  }

  const opts: GeneratorOptions = {
    entityName: capitalize(entityName),
    entityNameLower: entityName.toLowerCase(),
    entityNamePlural: pluralize(capitalize(entityName)),
    fields: []
  };

  console.log(`\\n🚀 Generating endpoint for: ${opts.entityName}\\n`);

  // Create directories
  const dirs = [
    `src/models`,
    `src/services/${opts.entityNameLower}`,
    `src/controllers/${opts.entityNameLower}`,
    `src/v1/routes/${opts.entityNameLower}`,
    `src/schemas`
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Generate files
  const files = [
    { path: `src/models/${opts.entityNameLower}.ts`, content: generateModel(opts) },
    { path: `src/services/${opts.entityNameLower}/${opts.entityNameLower}.service.ts`, content: generateService(opts) },
    { path: `src/controllers/${opts.entityNameLower}/${opts.entityNameLower}.controller.ts`, content: generateController(opts) },
    { path: `src/v1/routes/${opts.entityNameLower}/${opts.entityNameLower}.route.ts`, content: generateRoute(opts) },
    { path: `src/schemas/${opts.entityNameLower}.schema.ts`, content: generateSchema(opts) }
  ];

  files.forEach(file => {
    fs.writeFileSync(file.path, file.content);
    console.log(`✅ Created: ${file.path}`);
  });

  console.log(`\\n✨ Endpoint generated successfully!\\n`);
  console.log(`Next steps:`);
  console.log(`  1. Update the model fields in src/models/${opts.entityNameLower}.ts`);
  console.log(`  2. Add validation rules in src/schemas/${opts.entityNameLower}.schema.ts`);
  console.log(`  3. Mount the route in src/index.ts:`);
  console.log(`     import ${opts.entityNameLower}Router from "./v1/routes/${opts.entityNameLower}/${opts.entityNameLower}.route";`);
  console.log(`     app.use("/v1/${opts.entityNameLower}s", ${opts.entityNameLower}Router);`);
  console.log();
};

main();

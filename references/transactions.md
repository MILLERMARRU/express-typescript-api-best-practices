# Transaction Management Patterns

## Why Transactions?

Transactions ensure **ACID properties** (Atomicity, Consistency, Isolation, Durability) for multi-step database operations.

**Use transactions when:**
- Creating/updating multiple related records
- Operations must succeed or fail together
- Concurrent access requires data consistency
- Inventory/financial operations (prevent race conditions)

## Basic Transaction Pattern

```typescript
import { sequelize } from "../config/db";

export const crearVenta = async (ventaData: any) => {
  const transaction = await sequelize.transaction();

  try {
    // All database operations MUST pass transaction
    const venta = await Venta.create(ventaData, { transaction });

    // Related operations
    await DetalleVenta.bulkCreate(ventaData.detalles, { transaction });

    // Commit if all succeed
    await transaction.commit();
    return venta;
  } catch (error) {
    // Rollback if ANY operation fails
    await transaction.rollback();
    throw error;
  }
};
```

## Transaction Isolation Levels

Sequelize supports different isolation levels:

```typescript
import { Transaction } from "sequelize";

const transaction = await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
});

// Available levels:
// - READ_UNCOMMITTED
// - READ_COMMITTED (default)
// - REPEATABLE_READ
// - SERIALIZABLE
```

## Pessimistic Locking

Prevent concurrent modifications with row-level locks:

```typescript
export const actualizarInventario = async (producto_id: number, cantidad: number) => {
  const transaction = await sequelize.transaction();

  try {
    // Lock the row for update
    const inventario = await Inventario.findOne({
      where: { producto_id },
      transaction,
      lock: transaction.LOCK.UPDATE  // SELECT ... FOR UPDATE
    });

    if (!inventario) throw new Error("Inventario no encontrado");

    // Check stock availability
    if (inventario.cantidad < cantidad) {
      throw new Error("Stock insuficiente");
    }

    // Update safely
    inventario.cantidad -= cantidad;
    await inventario.save({ transaction });

    await transaction.commit();
    return inventario;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
```

**Lock Types:**
- `transaction.LOCK.UPDATE` - Pessimistic write lock (FOR UPDATE)
- `transaction.LOCK.SHARE` - Pessimistic read lock (FOR SHARE)

## Optimistic Locking

Use version numbers to detect concurrent modifications:

```typescript
// Model definition
Inventario.init({
  // ...
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  sequelize,
  version: true  // Enable optimistic locking
});

// Update with version check
export const actualizarInventario = async (id: number, cantidad: number, version: number) => {
  const [updated] = await Inventario.update(
    { cantidad, version: version + 1 },
    {
      where: {
        id,
        version  // Only update if version matches
      }
    }
  );

  if (updated === 0) {
    throw new Error("Conflicto: el registro fue modificado por otro usuario");
  }
};
```

## Complex Transaction: Sale with Stock Movement

Real-world example from production code:

```typescript
export const crearDetalleVenta = async (detalleVentaData: any[]) => {
  // Input validation
  if (!Array.isArray(detalleVentaData) || detalleVentaData.length === 0) {
    throw new Error('detalleVentaData debe ser un array no vacío');
  }

  const transaction = await sequelize.transaction();

  try {
    let total_subtotales = 0;

    // OPTIMIZATION: Batch load products (avoid N+1 queries)
    const productoIds = [...new Set(detalleVentaData.map(i => i.producto_id))];
    const productos = await Producto.findAll({
      where: { id: productoIds },
      transaction
    });
    const productoMap = new Map(productos.map(p => [p.id, p]));

    // Process each sale detail
    for (const item of detalleVentaData) {
      const { producto_id, cantidad } = item;

      // Validation
      if (!producto_id) throw new Error('producto_id es obligatorio');
      if (!cantidad || Number(cantidad) <= 0) throw new Error('cantidad debe ser > 0');

      const producto = productoMap.get(producto_id);
      if (!producto) throw new Error(`Producto ${producto_id} no encontrado`);

      // Auto-fill precio_unitario from product
      if (item.precio_unitario === undefined || item.precio_unitario === null) {
        item.precio_unitario = Number(producto.precio_minorista);
      } else {
        item.precio_unitario = Number(item.precio_unitario);
      }

      // Auto-calculate sub_total (2 decimal precision)
      if (item.sub_total === undefined || item.sub_total === null) {
        item.sub_total = parseFloat((item.precio_unitario * Number(cantidad)).toFixed(2));
      } else {
        item.sub_total = parseFloat(Number(item.sub_total).toFixed(2));
      }

      total_subtotales = parseFloat((total_subtotales + Number(item.sub_total)).toFixed(2));

      // Create stock movement FIRST (referential integrity)
      const movimiento = await crearMovimiento({
        tipo: "salida",
        producto_id: item.producto_id,
        almacen_id: item.almacen_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descripcion: `Salida por venta ID: ${item.venta_id}`
      }, transaction);

      // Assign movement ID to sale detail
      item.movimiento_id = movimiento.id;
    }

    // Bulk insert sale details (performance)
    const detalleVentaCreado = await DetalleVenta.bulkCreate(detalleVentaData, {
      transaction
    });

    // Update parent sale total with pessimistic lock
    const ventaId = detalleVentaData[0].venta_id;
    if (!ventaId) throw new Error('venta_id es obligatorio');

    const venta = await Venta.findOne({
      where: { id: ventaId },
      transaction,
      lock: transaction.LOCK.UPDATE  // Prevent concurrent updates
    });

    if (!venta) throw new Error(`Venta ${ventaId} no encontrada`);

    const currentTotal = Number(venta.total || 0);

    // Business rule: update total if 0 or less than sum of subtotals
    if (currentTotal === 0 || currentTotal < total_subtotales) {
      venta.total = total_subtotales;
      await venta.save({ transaction });
    }

    await transaction.commit();
    return detalleVentaCreado;
  } catch (error) {
    await transaction.rollback();
    console.error('Error en transacción:', error);
    throw error;
  }
};
```

**Key Patterns:**
1. ✅ Validate input BEFORE transaction
2. ✅ Batch load related data (performance)
3. ✅ Process items sequentially when order matters
4. ✅ Use bulk operations when possible
5. ✅ Lock parent records before update
6. ✅ Always pass transaction to ALL operations
7. ✅ Commit on success, rollback on ANY error

## Nested Transactions (Savepoints)

Sequelize doesn't support true nested transactions, but you can use savepoints:

```typescript
const transaction = await sequelize.transaction();

try {
  await operation1(transaction);

  // Create savepoint
  const savepoint = await transaction.createSavepoint('savepoint1');

  try {
    await operation2(transaction);
    await savepoint.commit();
  } catch (error) {
    // Rollback to savepoint (keeps operation1)
    await savepoint.rollback();
  }

  await transaction.commit();
} catch (error) {
  await transaction.rollback();
}
```

## Transaction Hooks

Execute logic before/after commit/rollback:

```typescript
const transaction = await sequelize.transaction();

transaction.afterCommit(async () => {
  // Send notification, update cache, etc.
  console.log('Transaction committed successfully');
});

try {
  await operations(transaction);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
}
```

## Managed Transactions (Alternative Pattern)

Sequelize can auto-manage transactions:

```typescript
// Auto-commit/rollback based on callback result
await sequelize.transaction(async (t) => {
  const venta = await Venta.create(data, { transaction: t });
  await DetalleVenta.bulkCreate(detalles, { transaction: t });
  return venta;
});

// No need for try/catch, manual commit/rollback
```

**Pros:**
- Less boilerplate
- Automatic commit/rollback

**Cons:**
- Less control over error handling
- Harder to add custom logic

**Recommendation:** Use manual transactions for complex operations with custom error handling.

## Deadlock Prevention

Prevent deadlocks by:

1. **Always acquire locks in the same order**

```typescript
// ❌ BAD: Different lock order
async function transferStock(from_id, to_id, cantidad) {
  const from = await Inventario.findByPk(from_id, { lock: true });
  const to = await Inventario.findByPk(to_id, { lock: true });
}

// ✅ GOOD: Consistent lock order
async function transferStock(from_id, to_id, cantidad) {
  const [id1, id2] = from_id < to_id ? [from_id, to_id] : [to_id, from_id];
  const inv1 = await Inventario.findByPk(id1, { lock: true });
  const inv2 = await Inventario.findByPk(id2, { lock: true });
}
```

2. **Keep transactions short**

```typescript
// ❌ BAD: Long-running transaction
const transaction = await sequelize.transaction();
const data = await fetchExternalAPI();  // Network call!
await Model.create(data, { transaction });
await transaction.commit();

// ✅ GOOD: Fetch data first, then transact
const data = await fetchExternalAPI();
const transaction = await sequelize.transaction();
await Model.create(data, { transaction });
await transaction.commit();
```

3. **Use appropriate isolation levels**

```typescript
// For read-heavy operations
const transaction = await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
});

// For critical financial operations
const transaction = await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
});
```

## Error Handling in Transactions

Categorize and handle errors appropriately:

```typescript
export const crearUsuario = async (data: any) => {
  const transaction = await sequelize.transaction();

  try {
    const usuario = await Usuario.create(data, { transaction });
    await transaction.commit();
    return usuario;
  } catch (error: any) {
    await transaction.rollback();

    // Categorize errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new Error(`El ${error.errors[0].path} ya existe`);
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new Error('Referencia inválida a registro relacionado');
    }

    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message).join(', ');
      throw new Error(`Validación fallida: ${messages}`);
    }

    // Re-throw unknown errors
    throw error;
  }
};
```

## Performance Optimization

### Batch Operations

```typescript
// ❌ SLOW: Individual inserts
for (const item of items) {
  await Model.create(item, { transaction });
}

// ✅ FAST: Bulk insert
await Model.bulkCreate(items, { transaction });
```

### Eager Loading

```typescript
// ❌ N+1 queries
const usuarios = await Usuario.findAll({ transaction });
for (const usuario of usuarios) {
  usuario.roles = await usuario.getRoles({ transaction });  // N queries!
}

// ✅ Single query with JOIN
const usuarios = await Usuario.findAll({
  include: [{ model: Rol, as: "roles" }],
  transaction
});
```

## Testing Transactions

```typescript
describe('crearVenta', () => {
  it('should rollback on error', async () => {
    const initialCount = await Venta.count();

    try {
      await crearVenta({ invalid: 'data' });
    } catch (error) {
      // Expected error
    }

    const finalCount = await Venta.count();
    expect(finalCount).toBe(initialCount);  // No records created
  });

  it('should commit on success', async () => {
    const venta = await crearVenta(validData);

    const saved = await Venta.findByPk(venta.id);
    expect(saved).toBeTruthy();  // Record persisted
  });
});
```

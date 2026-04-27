# Plan de Migración a sheet.best - PRODUCCIÓN

## Pasos completados:
- [x] 1. Agregar constante SHEETBEST_API y funciones helper (sbGet, sbPost, sbPut, sbDelete)
- [x] 2. Agregar funciones de normalización de datos (sheet.best devuelve strings)
- [x] 3. Convertir `cargarDatos()` a async para cargar desde sheet.best con fallback a localStorage
- [x] 4. Convertir `inicializarApp()` a async
- [x] 5. Marcar `sincronizarExcel()` como obsoleto (ya no usa localhost)
- [x] 6. Actualizar `guardarCliente()` para sincronizar POST/PUT con sheet.best
- [x] 7. Actualizar `eliminarCliente()` para sincronizar DELETE con sheet.best
- [x] 8. Actualizar `guardarProducto()` para sincronizar POST/PUT con sheet.best
- [x] 9. Actualizar `eliminarProducto()` para sincronizar DELETE con sheet.best
- [x] 10. Actualizar `registrarVenta()` para sincronizar POST venta + PUT stock con sheet.best
- [x] 11. Actualizar `eliminarVenta()` para sincronizar DELETE con sheet.best
- [x] 12. Verificar flujo completo (carga inicial, creación, edición, eliminación)

## Resumen de cambios aplicados:

### script.js
- Integración completa con sheet.best API: `https://api.sheetbest.com/sheets/374a3909-caf8-4232-8572-da1c862226ec`
- Helpers asíncronos: `sbGet`, `sbPost`, `sbPut`, `sbDelete`
- Normalización de datos para convertir strings de sheet.best a números/tipos correctos
- Carga inicial async desde 3 pestañas (`Clientes`, `Productos`, `Ventas`) con fallback a localStorage
- Cada mutación (crear/editar/eliminar) sincroniza incrementalmente con sheet.best
- `sincronizarExcel()` deprecado (ya no llama a localhost:3000)
- Exportar/Importar Excel local preservado como backup opcional

### Requisitos en Google Sheets
Asegúrate de que tu hoja de sheet.best tenga 3 pestañas exactamente nombradas:
1. `Clientes` — columnas: `id`, `nombre`, `telefono`, `direccion`, `moto`, `fecha`
2. `Productos` — columnas: `id`, `nombre`, `precio`, `cantidad`, `stockMin`, `fecha`
3. `Ventas` — columnas: `id`, `clienteId`, `cliente`, `productoId`, `producto`, `cantidad`, `precioUnitario`, `total`, `fecha`

### Estado final
✅ Aplicación lista para producción. Puedes desplegar `index.html`, `style.css`, `script.js`, `manifest.json` y `sw.js` en cualquier hosting estático (GitHub Pages, Netlify, Vercel, etc.). Ya no requiere `node server.js`.


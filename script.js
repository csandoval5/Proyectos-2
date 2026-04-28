// =================================================================
// CONFIGURACION SUPABASE
// =================================================================
const SUPABASE_URL = 'https://cdvmqzhqjskknfntomtx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wWPwhAUH6NZFYx0j5t1mSA_OebPJgoX';

const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
};

// =================================================================
// ESTADO LOCAL (localStorage como fuente principal)
// =================================================================
let clientes = [];
let productos = [];
let ventas = [];
let chartVentas = null;
let clienteEditandoId = null;
let productoEditandoId = null;

function cargarLocal() {
    try {
        clientes = JSON.parse(localStorage.getItem('tm_clientes') || '[]');
        productos = JSON.parse(localStorage.getItem('tm_productos') || '[]');
        ventas = JSON.parse(localStorage.getItem('tm_ventas') || '[]');
    } catch (e) {
        clientes = []; productos = []; ventas = [];
    }
}

function guardarLocal() {
    localStorage.setItem('tm_clientes', JSON.stringify(clientes));
    localStorage.setItem('tm_productos', JSON.stringify(productos));
    localStorage.setItem('tm_ventas', JSON.stringify(ventas));
}

// =================================================================
// SUPABASE HELPERS (no bloqueantes)
// =================================================================
async function sbGet(tabla) {
    try {
        const res = await fetch(`${SUPABASE_URL}/${tabla}?select=*`, { headers: sbHeaders });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    } catch (e) { console.warn('Supabase GET error:', e); return null; }
}

async function sbPost(tabla, data) {
    try {
        const res = await fetch(`${SUPABASE_URL}/${tabla}`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(await res.text());
        return true;
    } catch (e) { console.warn('Supabase POST error:', e); return false; }
}

async function sbPatch(tabla, id, data) {
    try {
        const res = await fetch(`${SUPABASE_URL}/${tabla}?id=eq.${id}`, { method: 'PATCH', headers: sbHeaders, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(await res.text());
        return true;
    } catch (e) { console.warn('Supabase PATCH error:', e); return false; }
}

async function sbDelete(tabla, id) {
    try {
        const res = await fetch(`${SUPABASE_URL}/${tabla}?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders });
        if (!res.ok) throw new Error(await res.text());
        return true;
    } catch (e) { console.warn('Supabase DELETE error:', e); return false; }
}

// Sincronizacion en segundo plano (no bloquea UI)
async function sincronizarConSupabase() {
    console.log('Sincronizando con Supabase...');
    const [c, p, v] = await Promise.all([sbGet('clientes'), sbGet('productos'), sbGet('ventas')]);
    let cambios = false;
    if (c && c.length > 0) { clientes = c; cambios = true; }
    if (p && p.length > 0) { productos = p; cambios = true; }
    if (v && v.length > 0) { ventas = v; cambios = true; }
    if (cambios) {
        guardarLocal();
        actualizarVistaCompleta();
        console.log('Datos sincronizados desde Supabase');
    }
}

// =================================================================
// INICIALIZACION
// =================================================================
function inicializarApp() {
    cargarLocal();
    vincularEventosUI();
    actualizarVistaCompleta();
    // Intentar sincronizar con Supabase en segundo plano
    sincronizarConSupabase().catch(e => console.warn('Fallo sincronizacion inicial:', e));
}

function esc(t) {
    return String(t || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#39;'}[m]));
}

// =================================================================
// PRODUCTOS
// =================================================================
function renderizarProductos() {
    const cont = document.getElementById('listaProductos');
    if (!cont) return;
    if (productos.length === 0) {
        cont.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><i class="fas fa-box-open" style="font-size:3rem;margin-bottom:16px;display:block;"></i>No hay productos registrados</div>';
        return;
    }
    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Repuesto</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
    productos.forEach(p => {
        const cant = parseInt(p.cantidad) || 0;
        const min = parseInt(p.stockmin) || 5;
        const bajo = cant <= min;
        const clase = cant <= 0 ? 'status-critical' : (bajo ? 'status-low' : 'status-ok');
        const estado = cant <= 0 ? 'Agotado' : (bajo ? 'Bajo' : 'OK');
        html += `<tr>
            <td>${p.id}</td>
            <td><strong>${esc(p.nombre)}</strong></td>
            <td>$${parseFloat(p.precio || 0).toFixed(2)}</td>
            <td>${cant}</td>
            <td><span class="badge ${clase}">${estado}</span></td>
            <td class="acciones">
                <button onclick="prepararEdicionProducto(${p.id})" class="btn-icon" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="eliminarProducto(${p.id})" class="btn-icon btn-danger" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    cont.innerHTML = html + '</tbody></table>';
}

async function guardarProducto(e) {
    e.preventDefault();
    const id = productoEditandoId || Date.now();
    const data = {
        id: id,
        nombre: document.getElementById('productoNombre').value.trim(),
        precio: parseFloat(document.getElementById('productoPrecio').value),
        cantidad: parseInt(document.getElementById('productoCantidad').value),
        stockmin: parseInt(document.getElementById('productoStockMin').value) || 5,
        fecha: new Date().toLocaleDateString()
    };

    if (!data.nombre || isNaN(data.precio) || isNaN(data.cantidad)) {
        return Swal.fire('Error', 'Datos incompletos o invalidos', 'error');
    }

    const idx = productos.findIndex(p => p.id == id);
    if (idx >= 0) productos[idx] = data; else productos.push(data);
    guardarLocal();

    // Sync a Supabase en segundo plano
    const existeEnSupabase = await sbGet('productos').then(list => (list || []).some(p => p.id == id));
    if (existeEnSupabase) sbPatch('productos', id, data); else sbPost('productos', data);

    productoEditandoId = null;
    document.getElementById('formProducto').reset();
    const btn = document.getElementById('btnSubmitProd');
    if (btn) btn.innerText = 'Guardar Producto';
    actualizarVistaCompleta();
    Swal.fire('Exito', 'Producto guardado', 'success');
}

async function eliminarProducto(id) {
    const c = await Swal.fire({
        title: 'Eliminar producto?',
        text: 'No se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!c.isConfirmed) return;

    productos = productos.filter(p => p.id != id);
    guardarLocal();
    sbDelete('productos', id);
    actualizarVistaCompleta();
    Swal.fire('Eliminado', 'Producto eliminado', 'success');
}

function prepararEdicionProducto(id) {
    const p = productos.find(x => x.id == id);
    if (!p) return;
    productoEditandoId = id;
    document.getElementById('productoNombre').value = p.nombre || '';
    document.getElementById('productoPrecio').value = p.precio || '';
    document.getElementById('productoCantidad').value = p.cantidad || '';
    document.getElementById('productoStockMin').value = p.stockmin || 5;
    const btn = document.getElementById('btnSubmitProd');
    if (btn) btn.innerText = 'Actualizar Producto';
    showTab('productos');
    document.getElementById('productoNombre').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =================================================================
// CLIENTES
// =================================================================
function renderizarClientes() {
    const cont = document.getElementById('listaClientes');
    if (!cont) return;
    if (clientes.length === 0) {
        cont.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><i class="fas fa-users" style="font-size:3rem;margin-bottom:16px;display:block;"></i>No hay clientes registrados</div>';
        return;
    }
    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Nombre</th><th>Telefono</th><th>Direccion</th><th>Moto</th><th>Acciones</th></tr></thead><tbody>';
    clientes.forEach(c => {
        html += `<tr>
            <td>${c.id}</td>
            <td>${esc(c.nombre)}</td>
            <td>${esc(c.telefono)}</td>
            <td>${esc(c.direccion)}</td>
            <td>${esc(c.moto)}</td>
            <td class="acciones">
                <button onclick="prepararEdicionCliente(${c.id})" class="btn-icon" title="Editar"><i class="fas fa-user-edit"></i></button>
                <button onclick="eliminarCliente(${c.id})" class="btn-icon btn-danger" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    cont.innerHTML = html + '</tbody></table>';
}

async function guardarCliente(e) {
    e.preventDefault();
    const nombre = document.getElementById('clienteNombre').value.trim();
    const telefono = document.getElementById('clienteTelefono').value.trim();
    if (!nombre || !telefono) return Swal.fire('Error', 'Nombre y telefono obligatorios', 'error');

    const id = clienteEditandoId || Date.now();
    const data = {
        id: id,
        nombre: nombre,
        telefono: telefono,
        direccion: document.getElementById('clienteDireccion').value || '',
        moto: document.getElementById('clienteMoto').value || '',
        fecha: new Date().toLocaleDateString()
    };

    const idx = clientes.findIndex(c => c.id == id);
    if (idx >= 0) clientes[idx] = data; else clientes.push(data);
    guardarLocal();

    sbPost('clientes', data);

    clienteEditandoId = null;
    document.getElementById('formCliente').reset();
    actualizarVistaCompleta();
    Swal.fire('Exito', 'Cliente guardado', 'success');
}

async function eliminarCliente(id) {
    const c = await Swal.fire({
        title: 'Eliminar cliente?',
        text: 'No se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!c.isConfirmed) return;

    clientes = clientes.filter(x => x.id != id);
    guardarLocal();
    sbDelete('clientes', id);
    actualizarVistaCompleta();
    Swal.fire('Eliminado', 'Cliente eliminado', 'success');
}

function prepararEdicionCliente(id) {
    const c = clientes.find(x => x.id == id);
    if (!c) return;
    clienteEditandoId = id;
    document.getElementById('clienteNombre').value = c.nombre || '';
    document.getElementById('clienteTelefono').value = c.telefono || '';
    document.getElementById('clienteDireccion').value = c.direccion || '';
    document.getElementById('clienteMoto').value = c.moto || '';
    showTab('clientes');
}

// =================================================================
// VENTAS
// =================================================================
function renderizarVentas() {
    const cont = document.getElementById('listaVentas');
    if (!cont) return;
    if (ventas.length === 0) {
        cont.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><i class="fas fa-receipt" style="font-size:3rem;margin-bottom:16px;display:block;"></i>No hay ventas registradas</div>';
        return;
    }
    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Cantidad</th><th>Total</th><th>Acciones</th></tr></thead><tbody>';
    ventas.forEach(v => {
        html += `<tr>
            <td>${v.id}</td>
            <td>${esc(v.fecha)}</td>
            <td>${esc(v.cliente)}</td>
            <td>${esc(v.producto)}</td>
            <td>${v.cantidad}</td>
            <td>$${parseFloat(v.total || 0).toFixed(2)}</td>
            <td class="acciones">
                <button onclick="eliminarVenta(${v.id})" class="btn-icon btn-danger" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    cont.innerHTML = html + '</tbody></table>';
}

async function registrarVenta(e) {
    e.preventDefault();
    const cId = document.getElementById('ventaCliente').value;
    const pId = document.getElementById('ventaProducto').value;
    const cant = parseInt(document.getElementById('ventaCantidad').value);

    if (!cId || !pId || !cant || cant < 1) return Swal.fire('Error', 'Seleccione cliente, producto y cantidad valida', 'error');

    const cli = clientes.find(c => c.id == cId);
    const prod = productos.find(p => p.id == pId);
    if (!cli || !prod) return Swal.fire('Error', 'Cliente o producto no encontrado', 'error');

    const stockActual = parseInt(prod.cantidad) || 0;
    if (cant > stockActual) return Swal.fire('Atencion', 'Stock insuficiente: ' + stockActual, 'warning');

    const venta = {
        id: Date.now(),
        cliente: cli.nombre,
        producto: prod.nombre,
        cantidad: cant,
        total: cant * parseFloat(prod.precio || 0),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!c.isConfirmed) return;

    const ok = await sbDelete('ventas', id);
    if (!ok) return Swal.fire('Error', 'No se pudo eliminar', 'error');

    await sincronizarTodo();
    actualizarVistaCompleta();
    Swal.fire('Eliminado', 'Venta eliminada', 'success');
}

// =================================================================
// DASHBOARD & EVENTOS
// =================================================================

function actualizarDashboard() {
    const totalVentas = ventas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
    const bajoStock = productos.filter(p => (p.cantidad || 0) <= (p.stockmin || 5)).length;

    const el = id => document.getElementById(id);
    if (el('dashIngresos')) el('dashIngresos').innerText = '$' + totalVentas.toFixed(2);
    if (el('dashVentasCount')) el('dashVentasCount').innerText = ventas.length;
    if (el('dashAlertas')) el('dashAlertas').innerText = bajoStock;

    if (el('totalClientes')) el('totalClientes').innerText = clientes.length;
    if (el('totalProductos')) el('totalProductos').innerText = productos.length;
    if (el('totalVentas')) el('totalVentas').innerText = ventas.length;
    if (el('totalIngresos')) el('totalIngresos').innerText = '$' + totalVentas.toFixed(2);

    if (el('badgeClientes')) el('badgeClientes').innerText = clientes.length;
    if (el('badgeProductos')) el('badgeProductos').innerText = productos.length;
    if (el('badgeVentas')) el('badgeVentas').innerText = ventas.length;

    if (el('countClientes')) el('countClientes').innerText = clientes.length;
    if (el('countProductos')) el('countProductos').innerText = productos.length;
    if (el('countVentas')) el('countVentas').innerText = ventas.length;

    actualizarReportes();
}

function actualizarReportes() {
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = ventas.filter(v => v.fecha === hoy);
    const ingresosHoy = ventasHoy.reduce((a, v) => a + (parseFloat(v.total) || 0), 0);

    const el = id => document.getElementById(id);
    if (el('ventasHoy')) el('ventasHoy').innerText = ventasHoy.length;
    if (el('ingresosHoy')) el('ingresosHoy').innerText = '$' + ingresosHoy.toFixed(2);

    const clienteCount = {};
    ventas.forEach(v => { clienteCount[v.cliente] = (clienteCount[v.cliente] || 0) + 1; });
    const mejorCliente = Object.entries(clienteCount).sort((a, b) => b[1] - a[1])[0];
    if (el('mejorCliente')) el('mejorCliente').innerText = mejorCliente ? mejorCliente[0] : 'N/A';
    if (el('ventasMejorCliente')) el('ventasMejorCliente').innerText = mejorCliente ? mejorCliente[1] : 0;

    const productoCount = {};
    ventas.forEach(v => { productoCount[v.producto] = (productoCount[v.producto] || 0) + (parseInt(v.cantidad) || 0); });
    const prodMasVendido = Object.entries(productoCount).sort((a, b) => b[1] - a[1])[0];
    if (el('productoMasVendido')) el('productoMasVendido').innerText = prodMasVendido ? prodMasVendido[0] : 'N/A';
    if (el('unidadesVendidas')) el('unidadesVendidas').innerText = prodMasVendido ? prodMasVendido[1] : 0;

    const stockCritico = productos.filter(p => (p.cantidad || 0) <= 0).length;
    if (el('stockCritico')) el('stockCritico').innerText = stockCritico;

    actualizarGraficaVentas();
}

function actualizarGraficaVentas() {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;

    const ventasPorFecha = {};
    ventas.forEach(v => { ventasPorFecha[v.fecha] = (ventasPorFecha[v.fecha] || 0) + (parseFloat(v.total) || 0); });
    const fechas = Object.keys(ventasPorFecha).sort();
    const totales = fechas.map(f => ventasPorFecha[f]);

    if (chartVentas) {
        chartVentas.data.labels = fechas;
        chartVentas.data.datasets[0].data = totales;
        chartVentas.update();
    } else {
        chartVentas = new Chart(ctx, {
            type: 'line',
            data: {
                labels: fechas,
                datasets: [{
                    label: 'Ventas ($)',
                    data: totales,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52,152,219,0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

// =================================================================
// EVENTOS UI
// =================================================================

function vincularEventosUI() {
    document.getElementById('formProducto')?.addEventListener('submit', guardarProducto);
    document.getElementById('formCliente')?.addEventListener('submit', guardarCliente);
    document.getElementById('formVenta')?.addEventListener('submit', registrarVenta);

    const actualizarTotalVenta = () => {
        const p = productos.find(x => x.id == document.getElementById('ventaProducto').value);
        const c = document.getElementById('ventaCantidad').value || 0;
        if (p && document.getElementById('ventaTotal')) {
            document.getElementById('ventaTotal').value = '$' + (parseFloat(p.precio || 0) * c).toFixed(2);
        }
        const precioProd = document.getElementById('precioProducto');
        if (precioProd && p) precioProd.innerText = 'Precio unitario: $' + parseFloat(p.precio || 0).toFixed(2);
    };

    document.getElementById('ventaProducto')?.addEventListener('change', actualizarTotalVenta);
    document.getElementById('ventaCantidad')?.addEventListener('input', actualizarTotalVenta);

    const buscador = document.getElementById('buscador');
    const filtroTipo = document.getElementById('filtroTipo');
    buscador?.addEventListener('input', () => filtrarTablas(buscador.value, filtroTipo?.value || 'todos'));
    filtroTipo?.addEventListener('change', () => filtrarTablas(buscador.value, filtroTipo.value));

    document.getElementById('btnExportarExcel')?.addEventListener('click', exportarExcel);
    document.getElementById('btnImportarExcel')?.addEventListener('click', () => document.getElementById('inputExcel')?.click());
    document.getElementById('inputExcel')?.addEventListener('change', importarExcel);
    document.getElementById('btnExportar')?.addEventListener('click', exportarJSON);
    document.getElementById('btnConfig')?.addEventListener('click', mostrarConfiguracion);
}

function filtrarTablas(query, tipo) {
    const q = query.toLowerCase().trim();
    const contenedores = [];
    if (tipo === 'todos' || tipo === 'productos') contenedores.push('listaProductos');
    if (tipo === 'todos' || tipo === 'clientes') contenedores.push('listaClientes');
    if (tipo === 'todos' || tipo === 'ventas') contenedores.push('listaVentas');

    contenedores.forEach(id => {
        const cont = document.getElementById(id);
        if (!cont) return;
        cont.querySelectorAll('tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

function actualizarVistaCompleta() {
    renderizarProductos();
    renderizarClientes();
    renderizarVentas();
    actualizarDashboard();

    const sc = document.getElementById('ventaCliente'), sp = document.getElementById('ventaProducto');
    if (sc) sc.innerHTML = '<option value="">Seleccionar Cliente</option>' + clientes.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    if (sp) sp.innerHTML = '<option value="">Seleccionar Repuesto</option>' + productos.map(p => `<option value="${p.id}">${esc(p.nombre)} (Stock: ${p.cantidad || 0})</option>`).join('');
}

function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
        const onclick = b.getAttribute('onclick') || '';
        b.classList.toggle('active', onclick.includes(id));
    });
}

// =================================================================
// EXPORTAR / IMPORTAR / UTILIDADES
// =================================================================

function exportarExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes), 'Clientes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos), 'Productos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas), 'Ventas');
    XLSX.writeFile(wb, 'inventario-' + new Date().toISOString().split('T')[0] + '.xlsx');
}

function importarExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetClientes = workbook.Sheets['Clientes'];
        const sheetProductos = workbook.Sheets['Productos'];
        const sheetVentas = workbook.Sheets['Ventas'];

        if (sheetClientes) {
            const datos = XLSX.utils.sheet_to_json(sheetClientes);
            for (const d of datos) await sbPost('clientes', d);
        }
        if (sheetProductos) {
            const datos = XLSX.utils.sheet_to_json(sheetProductos);
            for (const d of datos) await sbPost('productos', d);
        }
        if (sheetVentas) {
            const datos = XLSX.utils.sheet_to_json(sheetVentas);
            for (const d of datos) await sbPost('ventas', d);
        }

        await sincronizarTodo();
        actualizarVistaCompleta();
        Swal.fire('Importado', 'Datos importados desde Excel', 'success');
        e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function exportarJSON() {
    const data = { clientes, productos, ventas };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-inventario-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

async function mostrarConfiguracion() {
    const { value: accion } = await Swal.fire({
        title: 'Configuracion',
        input: 'select',
        inputOptions: { '': 'Seleccione', 'limpiar': 'Limpiar datos locales', 'url': 'Ver URL Supabase' },
        showCancelButton: true
    });
    if (accion === 'limpiar') {
        const c = await Swal.fire({ title: 'Esta seguro?', text: 'Solo limpia datos locales', icon: 'warning', showCancelButton: true, confirmButtonText: 'Si, limpiar' });
        if (c.isConfirmed) { clientes = []; productos = []; ventas = []; actualizarVistaCompleta(); Swal.fire('Limpiado', 'Datos locales eliminados', 'info'); }
    } else if (accion === 'url') {
        Swal.fire('URL Supabase', SUPABASE_URL, 'info');
    }
}

// INICIO
document.addEventListener('DOMContentLoaded', inicializarApp);


// Inicialización PRO
let clientes = [];
let productos = [];
let ventas = [];
let chartVentas = null;
let clienteEditandoId = null;
let productoEditandoId = null;

const SHEETBEST_API = "https://api.sheetbest.com/sheets/374a3909-caf8-4232-8572-da1c862226ec";

// Helpers Sheet.best
async function sbGet(tab) {
    const res = await fetch(`${SHEETBEST_API}/tabs/${tab}`);
    if (!res.ok) throw new Error(`Error GET ${tab}: ${res.status}`);
    return await res.json();
}
async function sbPost(tab, row) {
    const res = await fetch(`${SHEETBEST_API}/tabs/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(`Error POST ${tab}: ${res.status}`);
    return await res.json();
}
async function sbPut(tab, id, row) {
    const res = await fetch(`${SHEETBEST_API}/tabs/${tab}/id/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(`Error PUT ${tab}: ${res.status}`);
    return await res.json();
}
async function sbDelete(tab, id) {
    const res = await fetch(`${SHEETBEST_API}/tabs/${tab}/id/${id}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error(`Error DELETE ${tab}: ${res.status}`);
    return await res.json();
}

function normalizarClientes(arr) {
    return arr.map(x => ({
        id: Number(x.id) || Date.now(),
        nombre: String(x.nombre || ""),
        telefono: String(x.telefono || ""),
        direccion: String(x.direccion || ""),
        moto: String(x.moto || ""),
        fecha: String(x.fecha || new Date().toLocaleDateString())
    }));
}
function normalizarProductos(arr) {
    return arr.map(x => ({
        id: Number(x.id) || Date.now(),
        nombre: String(x.nombre || ""),
        precio: parseFloat(x.precio) || 0,
        cantidad: parseInt(x.cantidad) || 0,
        stockMin: parseInt(x.stockMin) || 5,
        fecha: String(x.fecha || new Date().toLocaleDateString())
    }));
}
function normalizarVentas(arr) {
    return arr.map(x => ({
        id: Number(x.id) || Date.now(),
        clienteId: Number(x.clienteId) || 0,
        cliente: String(x.cliente || ""),
        productoId: Number(x.productoId) || 0,
        producto: String(x.producto || ""),
        cantidad: parseInt(x.cantidad) || 0,
        precioUnitario: parseFloat(x.precioUnitario) || 0,
        total: parseFloat(x.total) || 0,
        fecha: String(x.fecha || new Date().toLocaleDateString())
    }));
}

async function inicializarApp() {
    await cargarDatos();
    configurarEventos();
    actualizarTodo();
}

function configurarEventos() {
    document.getElementById("formCliente").addEventListener("submit", function(e) {
        e.preventDefault();
        guardarCliente(false, null);
    });
    document.getElementById("formProducto").addEventListener("submit", function(e) {
        e.preventDefault();
        guardarProducto(false, null);
    });
    document.getElementById("formVenta").addEventListener("submit", function(e) {
        e.preventDefault();
        registrarVenta();
    });
    document.getElementById("btnExportarExcel").addEventListener("click", exportarExcelManual);
    document.getElementById("btnImportarExcel").addEventListener("click", function() {
        document.getElementById("inputExcel").click();
    });
    document.getElementById("inputExcel").addEventListener("change", importarExcel);
    document.getElementById("btnExportar").addEventListener("click", exportarJson);
    document.getElementById("btnConfig").addEventListener("click", function() {
        Swal.fire('Configuracion', 'Funcionalidad de configuracion en desarrollo', 'info');
    });
    document.getElementById("ventaProducto").addEventListener("change", calcularTotalVenta);
    document.getElementById("ventaCantidad").addEventListener("input", calcularTotalVenta);
    document.getElementById("buscador").addEventListener("input", buscarGlobal);
}

function guardarDatos() {
    localStorage.setItem("clientes", JSON.stringify(clientes));
    localStorage.setItem("productos", JSON.stringify(productos));
    localStorage.setItem("ventas", JSON.stringify(ventas));
}

async function cargarDatos() {
    try {
        const [c, p, v] = await Promise.all([
            sbGet("Clientes"),
            sbGet("Productos"),
            sbGet("Ventas")
        ]);
        clientes = normalizarClientes(c);
        productos = normalizarProductos(p);
        ventas = normalizarVentas(v);
        guardarDatos(); // Cache local
        console.log("Datos cargados desde sheet.best");
    } catch (err) {
        console.warn("sheet.best no disponible, usando localStorage:", err);
        clientes = JSON.parse(localStorage.getItem("clientes")) || [];
        productos = JSON.parse(localStorage.getItem("productos")) || [];
        ventas = JSON.parse(localStorage.getItem("ventas")) || [];
    }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.innerText.toLowerCase().includes(tabId)) btn.classList.add('active');
    });
}

function mostrarClientes() {
    const cont = document.getElementById("listaClientes");
    cont.innerHTML = "";
    if (clientes.length === 0) {
        cont.innerHTML = '<p style="padding:20px;text-align:center;color:#999">No hay clientes registrados</p>';
        return;
    }
    cont.innerHTML = '<table class="data-table"><thead><tr><th>ID</th><th>Nombre</th><th>Telefono</th><th>Direccion</th><th>Moto</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>' +
        clientes.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>${c.telefono}</td>
                <td>${c.direccion || '-'}</td>
                <td>${c.moto || '-'}</td>
                <td>${c.fecha}</td>
                <td class="acciones">
                    <button onclick="editarCliente(${c.id})" class="btn-icon" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="eliminarCliente(${c.id})" class="btn-icon btn-danger" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('') + '</tbody></table>';
}

function cargarClientesEnSelect() {
    const select = document.getElementById("ventaCliente");
    select.innerHTML = clientes.length ? '' : '<option value="">Sin clientes</option>';
    clientes.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.nombre;
        select.appendChild(option);
    });
}

async function guardarCliente(editando, id) {
    const clienteData = {
        id: id || Date.now(),
        nombre: document.getElementById('clienteNombre').value.trim(),
        telefono: document.getElementById('clienteTelefono').value.trim(),
        direccion: document.getElementById('clienteDireccion').value.trim(),
        moto: document.getElementById('clienteMoto').value.trim(),
        fecha: new Date().toLocaleDateString()
    };
    if (!clienteData.nombre || !clienteData.telefono) {
        Swal.fire('Error', 'Nombre y Telefono son obligatorios', 'error');
        return;
    }
    if (editando) {
        const idx = clientes.findIndex(c => c.id === id);
        if (idx > -1) clientes[idx] = clienteData;
        try { await sbPut("Clientes", id, clienteData); } catch(e) { console.error(e); }
        Swal.fire('Actualizado', 'Cliente actualizado correctamente', 'success');
    } else {
        clientes.push(clienteData);
        try { await sbPost("Clientes", clienteData); } catch(e) { console.error(e); }
        Swal.fire('Guardado', 'Cliente guardado correctamente', 'success');
    }
    guardarDatos();
    mostrarClientes();
    cargarClientesEnSelect();
    document.getElementById('formCliente').reset();
    actualizarTodo();
}

function editarCliente(id) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('clienteNombre').value = c.nombre;
    document.getElementById('clienteTelefono').value = c.telefono;
    document.getElementById('clienteDireccion').value = c.direccion || '';
    document.getElementById('clienteMoto').value = c.moto || '';
    const btn = document.querySelector('#formCliente button[type="submit"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Cliente';
    const newHandler = function(e) {
        e.preventDefault();
        guardarCliente(true, id);
        btn.innerHTML = oldText;
        document.getElementById("formCliente").removeEventListener("submit", newHandler);
        document.getElementById("formCliente").addEventListener("submit", function(ev) {
            ev.preventDefault();
            guardarCliente(false, null);
        });
    };
    document.getElementById("formCliente").removeEventListener("submit", arguments.callee.oldHandler);
    document.getElementById("formCliente").addEventListener("submit", newHandler);
}

async function eliminarCliente(id) {
    Swal.fire({
        title: 'Eliminar cliente?',
        text: 'Esta accion no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            clientes = clientes.filter(c => c.id !== id);
            guardarDatos();
            mostrarClientes();
            cargarClientesEnSelect();
            actualizarTodo();
            try { await sbDelete("Clientes", id); } catch(e) { console.error(e); }
            Swal.fire('Eliminado', 'Cliente eliminado', 'success');
        }
    });
}

function mostrarProductos() {
    const cont = document.getElementById("listaProductos");
    cont.innerHTML = "";
    if (productos.length === 0) {
        cont.innerHTML = '<p style="padding:20px;text-align:center;color:#999">No hay productos registrados</p>';
        return;
    }
    cont.innerHTML = '<table class="data-table"><thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Cantidad</th><th>Stock Min</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>' +
        productos.map(p => {
            let estado = '';
            let clase = '';
            if (p.cantidad <= 0) { estado = 'Critico'; clase = 'estado-critico'; }
            else if (p.cantidad <= p.stockMin) { estado = 'Bajo'; clase = 'estado-bajo'; }
            else { estado = 'Ok'; clase = 'estado-ok'; }
            return `<tr>
                <td>${p.id}</td>
                <td>${p.nombre}</td>
                <td>$${p.precio.toFixed(2)}</td>
                <td>${p.cantidad}</td>
                <td>${p.stockMin}</td>
                <td><span class="${clase}">${estado}</span></td>
                <td>${p.fecha}</td>
                <td class="acciones">
                    <button onclick="editarProducto(${p.id})" class="btn-icon" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="eliminarProducto(${p.id})" class="btn-icon btn-danger" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('') + '</tbody></table>';
}

function cargarProductosEnSelect() {
    const select = document.getElementById("ventaProducto");
    select.innerHTML = productos.length ? '' : '<option value="">Sin productos</option>';
    productos.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.nombre;
        select.appendChild(option);
    });
    calcularTotalVenta();
}

async function guardarProducto(editando, id) {
    const cantidadVal = parseInt(document.getElementById('productoCantidad').value);
    const precioVal = parseFloat(document.getElementById('productoPrecio').value);
    const productoData = {
        id: id || Date.now(),
        nombre: document.getElementById('productoNombre').value.trim(),
        precio: isNaN(precioVal) ? 0 : precioVal,
        cantidad: isNaN(cantidadVal) ? 0 : cantidadVal,
        stockMin: parseInt(document.getElementById('productoStockMin').value) || 5,
        fecha: new Date().toLocaleDateString()
    };
    if (!productoData.nombre) {
        Swal.fire('Error', 'El nombre del producto es obligatorio', 'error');
        return;
    }
    if (editando) {
        const idx = productos.findIndex(p => p.id === id);
        if (idx > -1) productos[idx] = productoData;
        try { await sbPut('Productos', id, productoData); } catch(e) { console.error(e); }
        Swal.fire('Actualizado', 'Producto actualizado correctamente', 'success');
    } else {
        productos.push(productoData);
        try { await sbPost('Productos', productoData); } catch(e) { console.error(e); }
        Swal.fire('Guardado', 'Producto guardado correctamente', 'success');
    }
    guardarDatos();
    mostrarProductos();
    cargarProductosEnSelect();
    document.getElementById('formProducto').reset();
    actualizarTodo();
}

function editarProducto(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('productoNombre').value = p.nombre;
    document.getElementById('productoPrecio').value = p.precio;
    document.getElementById('productoCantidad').value = p.cantidad;
    document.getElementById('productoStockMin').value = p.stockMin;
    const btn = document.querySelector('#formProducto button[type="submit"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Producto';
    const newHandler = function(e) {
        e.preventDefault();
        guardarProducto(true, id);
        btn.innerHTML = oldText;
        document.getElementById("formProducto").removeEventListener("submit", newHandler);
        document.getElementById("formProducto").addEventListener("submit", function(ev) {
            ev.preventDefault();
            guardarProducto(false, null);
        });
    };
    document.getElementById("formProducto").addEventListener("submit", newHandler);
}

async function eliminarProducto(id) {
    Swal.fire({
        title: 'Eliminar producto?',
        text: 'Esta accion no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            productos = productos.filter(p => p.id !== id);
            guardarDatos();
            mostrarProductos();
            cargarProductosEnSelect();
            actualizarTodo();
            try { await sbDelete('Productos', id); } catch(e) { console.error(e); }
            Swal.fire('Eliminado', 'Producto eliminado', 'success');
        }
    });
}

function mostrarVentas() {
    const cont = document.getElementById("listaVentas");
    cont.innerHTML = "";
    if (ventas.length === 0) {
        cont.innerHTML = '<p style="padding:20px;text-align:center;color:#999">No hay ventas registradas</p>';
        return;
    }
    cont.innerHTML = '<table class="data-table"><thead><tr><th>ID</th><th>Cliente</th><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Total</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>' +
        ventas.map(v => `
            <tr>
                <td>${v.id}</td>
                <td>${v.cliente}</td>
                <td>${v.producto}</td>
                <td>${v.cantidad}</td>
                <td>$${v.precioUnitario.toFixed(2)}</td>
                <td>$${v.total.toFixed(2)}</td>
                <td>${v.fecha}</td>
                <td class="acciones">
                    <button onclick="eliminarVenta(${v.id})" class="btn-icon btn-danger" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('') + '</tbody></table>';
}

async function registrarVenta() {
    const clienteId = parseInt(document.getElementById('ventaCliente').value);
    const productoId = parseInt(document.getElementById('ventaProducto').value);
    const cantidad = parseInt(document.getElementById('ventaCantidad').value);
    if (!clienteId || !productoId || isNaN(cantidad) || cantidad < 1) {
        Swal.fire('Error', 'Selecciona cliente, producto y cantidad valida', 'error');
        return;
    }
    const cliente = clientes.find(c => c.id === clienteId);
    const producto = productos.find(p => p.id === productoId);
    if (!cliente) { Swal.fire('Error', 'Cliente no valido', 'error'); return; }
    if (!producto) { Swal.fire('Error', 'Producto no valido', 'error'); return; }
    if (producto.cantidad < cantidad) {
        Swal.fire({ icon: 'error', title: 'Stock insuficiente', text: `Disponible: ${producto.cantidad}` });
        return;
    }
    const venta = {
        id: Date.now(),
        clienteId,
        cliente: cliente.nombre,
        productoId,
        producto: producto.nombre,
        cantidad,
        precioUnitario: producto.precio,
        total: cantidad * producto.precio,
        fecha: new Date().toLocaleDateString()
    };
    ventas.push(venta);
    producto.cantidad -= cantidad;
    guardarDatos();
    mostrarVentas();
    mostrarProductos();
    document.getElementById('formVenta').reset();
    calcularTotalVenta();
    actualizarTodo();
    Swal.fire({ icon: 'success', title: 'Venta registrada', text: `Total: $${venta.total.toFixed(2)}`, timer: 2500 });
    try { await sbPost('Ventas', venta); } catch(e) { console.error(e); }
    try { await sbPut('Productos', producto.id, producto); } catch(e) { console.error(e); }
}

async function eliminarVenta(id) {
    Swal.fire({
        title: 'Eliminar venta?',
        text: 'Esta accion no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            ventas = ventas.filter(v => v.id !== id);
            guardarDatos();
            mostrarVentas();
            actualizarTodo();
            try { await sbDelete('Ventas', id); } catch(e) { console.error(e); }
            Swal.fire('Eliminado', 'Venta eliminada', 'success');
        }
    });
}

function calcularTotalVenta() {
    const productoId = parseInt(document.getElementById('ventaProducto').value);
    const cantidad = parseInt(document.getElementById('ventaCantidad').value) || 0;
    const producto = productos.find(p => p.id === productoId);
    if (producto) {
        document.getElementById('ventaTotal').value = '$' + (cantidad * producto.precio).toFixed(2);
        document.getElementById('precioProducto').textContent = `Precio unitario: $${producto.precio.toFixed(2)} | Stock: ${producto.cantidad}`;
    } else {
        document.getElementById('ventaTotal').value = '$0.00';
        document.getElementById('precioProducto').textContent = '';
    }
}

function sincronizarExcel() {
    // Funcion deprecada: ahora se usa sheet.best directamente
}

function exportarExcelManual() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes), "Clientes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos), "Productos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas), "Ventas");
    XLSX.writeFile(wb, `inventario-${new Date().toISOString().split("T")[0]}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            clientes = XLSX.utils.sheet_to_json(workbook.Sheets["Clientes"]) || [];
            productos = XLSX.utils.sheet_to_json(workbook.Sheets["Productos"]) || [];
            ventas = XLSX.utils.sheet_to_json(workbook.Sheets["Ventas"]) || [];
            guardarDatos();
            actualizarTodo();
            Swal.fire("Datos importados", "Archivo Excel cargado correctamente", "success");
        } catch (err) {
            Swal.fire("Error", "No se pudo importar el archivo", "error");
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function exportarJson() {
    const data = JSON.stringify({ clientes, productos, ventas }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-inventario-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function buscarGlobal() {
    const q = document.getElementById("buscador").value.toLowerCase();
    const tipo = document.getElementById("filtroTipo").value;
    if (tipo === 'todos' || tipo === 'clientes') filtrarTabla("listaClientes", q);
    if (tipo === 'todos' || tipo === 'productos') filtrarTabla("listaProductos", q);
    if (tipo === 'todos' || tipo === 'ventas') filtrarTabla("listaVentas", q);
}

function filtrarTabla(contenedorId, q) {
    const cont = document.getElementById(contenedorId);
    const filas = cont.querySelectorAll('tbody tr');
    filas.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

function actualizarContadores() {
    document.getElementById("totalClientes").textContent = clientes.length;
    document.getElementById("totalProductos").textContent = productos.length;
    document.getElementById("totalVentas").textContent = ventas.length;
    const ingresos = ventas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    document.getElementById("totalIngresos").textContent = '$' + ingresos.toFixed(2);

    document.getElementById("countClientes").textContent = clientes.length;
    document.getElementById("countProductos").textContent = productos.length;
    document.getElementById("countVentas").textContent = ventas.length;

    document.getElementById("badgeClientes").textContent = clientes.length;
    document.getElementById("badgeProductos").textContent = productos.length;
    document.getElementById("badgeVentas").textContent = ventas.length;
}

function actualizarReportes() {
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = ventas.filter(v => v.fecha === hoy);
    const totalHoy = ventasHoy.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    document.getElementById("ventasHoy").textContent = ventasHoy.length;
    document.getElementById("ingresosHoy").textContent = '$' + totalHoy.toFixed(2);

    const conteoClientes = {};
    ventas.forEach(v => { conteoClientes[v.cliente] = (conteoClientes[v.cliente] || 0) + 1; });
    const mejor = Object.entries(conteoClientes).sort((a,b) => b[1]-a[1])[0];
    document.getElementById("mejorCliente").textContent = mejor ? mejor[0] : 'N/A';
    document.getElementById("ventasMejorCliente").textContent = mejor ? mejor[1] : 0;

    const conteoProd = {};
    ventas.forEach(v => { conteoProd[v.producto] = (conteoProd[v.producto] || 0) + v.cantidad; });
    const topProd = Object.entries(conteoProd).sort((a,b) => b[1]-a[1])[0];
    document.getElementById("productoMasVendido").textContent = topProd ? topProd[0] : 'N/A';
    document.getElementById("unidadesVendidas").textContent = topProd ? topProd[1] : 0;

    const critico = productos.filter(p => p.cantidad <= p.stockMin).length;
    document.getElementById("stockCritico").textContent = critico;

    renderizarGraficoVentas();
}

function renderizarGraficoVentas() {
    const ctx = document.getElementById("graficoVentas").getContext("2d");
    const ventasPorDia = {};
    ventas.forEach(v => {
        const dia = v.fecha || v.dia || 'Sin fecha';
        ventasPorDia[dia] = (ventasPorDia[dia] || 0) + (parseFloat(v.total) || 0);
    });
    const labels = Object.keys(ventasPorDia);
    const data = Object.values(ventasPorDia);
    if (chartVentas) chartVentas.destroy();
    if (labels.length === 0) {
        if (ctx) {
            ctx.clearRect(0, 0, 400, 200);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos de ventas', 200, 100);
        }
        return;
    }
    chartVentas = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Ingresos por dia',
                data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52,152,219,0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, plugins: { legend: { display: true } } }
    });
}

function actualizarTodo() {
    mostrarClientes();
    mostrarProductos();
    mostrarVentas();
    cargarClientesEnSelect();
    cargarProductosEnSelect();
    actualizarContadores();
    actualizarReportes();
}

document.addEventListener('DOMContentLoaded', inicializarApp);


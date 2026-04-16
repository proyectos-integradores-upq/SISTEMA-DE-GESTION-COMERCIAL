const API_BASE = "http://127.0.0.1:8000/api";
const token = localStorage.getItem("token");

const buscarProducto = document.getElementById("buscarProducto");
const resultadosProducto = document.getElementById("resultadosProducto");
const infoNombre = document.getElementById("infoNombre");
const infoCodigo = document.getElementById("infoCodigo");
const infoPrecioCompra = document.getElementById("infoPrecioCompra");
const infoStockActual = document.getElementById("infoStockActual");
const infoAlertaStock = document.getElementById("infoAlertaStock");
const proveedorEntrada = document.getElementById("proveedorEntrada");
const productoEntrada = document.getElementById("productoEntrada");
const btnAgregarProductoEntrada = document.getElementById("btnAgregarProductoEntrada");
const detalleProductosEntrada = document.getElementById("detalleProductosEntrada");
const totalEntrada = document.getElementById("totalEntrada");
const observacionEntrada = document.getElementById("observacionEntrada");
const mensajeEntrada = document.getElementById("mensajeEntrada");
const btnRegistrarEntrada = document.getElementById("btnRegistrarEntrada");
const tablaHistorialBody = document.getElementById("tablaHistorialBody");
const badgeHistorial = document.getElementById("badgeHistorial");
const kpiEntradas = document.getElementById("kpiEntradas");
const kpiTotalGastado = document.getElementById("kpiTotalGastado");
const modalDetalleEntrada = document.getElementById("modalDetalleEntrada");
const contenidoDetalleEntrada = document.getElementById("contenidoDetalleEntrada");
const btnCerrarModalDetalle = document.getElementById("btnCerrarModalDetalle");
const kpiProveedores = document.getElementById("kpiProveedores");
const filtroDesde = document.getElementById("filtroDesde");
const filtroHasta = document.getElementById("filtroHasta");
const filtroProveedorHistorial = document.getElementById("filtroProveedorHistorial");
const filtroProductoHistorial = document.getElementById("filtroProductoHistorial");
const topbarUsuarioNombre = document.getElementById("topbarUsuarioNombre");
const topbarUsuarioRol = document.getElementById("topbarUsuarioRol");

let proveedores = [];
let catalogoProductos = [];
let selectedProducto = null;
let selectedPrecioCompra = 0;
let selectedProductosEntrada = [];
const productosProveedorPorId = new Map();
let historialEntradas = [];
let historialFiltradoActual = [];

function getIdCompra(item) {
    return Number(item?.id_compra || item?.compra_id || 0);
}

function getResumenCompras(rows) {
    const grupos = new Map();

    rows.forEach((row) => {
        const idCompra = getIdCompra(row);
        const key = idCompra > 0 ? `c-${idCompra}` : `f-${row.id_detalle || row.fecha || Math.random()}`;
        const actual = grupos.get(key);

        if (!actual) {
            grupos.set(key, {
                ...row,
                _key: key,
                _items: [row],
                _total_compra: getSubtotalLinea(row),
            });
            return;
        }

        actual._items.push(row);
        actual._total_compra += getSubtotalLinea(row);
    });

    return Array.from(grupos.values());
}

if (!token) {
    window.location.href = "login.html";
}

function getHeaders(json = false) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatMoney(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function getPrecioUnitario(item) {
    const precio = Number(item?.precio_compra ?? item?.precio_unitario ?? 0);
    return Number.isFinite(precio) && precio >= 0 ? precio : 0;
}

function getCantidadLinea(item) {
    const cantidad = Number(item?.cantidad ?? 0);
    return Number.isFinite(cantidad) && cantidad >= 0 ? cantidad : 0;
}

function getSubtotalLinea(item) {
    const cantidad = getCantidadLinea(item);
    const precio = getPrecioUnitario(item);

    if (cantidad > 0) {
        return cantidad * precio;
    }

    const subtotalApi = Number(item?.subtotal ?? item?.total ?? 0);
    return Number.isFinite(subtotalApi) ? subtotalApi : 0;
}

function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("es-MX", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function parseDateValue(value) {
    if (!value) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    const mysqlMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);

    if (mysqlMatch) {
        const year = Number(mysqlMatch[1]);
        const month = Number(mysqlMatch[2]) - 1;
        const day = Number(mysqlMatch[3]);
        const hour = Number(mysqlMatch[4] || "0");
        const minute = Number(mysqlMatch[5] || "0");
        const second = Number(mysqlMatch[6] || "0");
        const parsed = new Date(year, month, day, hour, minute, second);

        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStockAlertText(stock) {
    const n = Number(stock || 0);

    if (n <= 5) return { text: "Stock bajo", ok: false };
    return { text: "Stock estable", ok: true };
}

function getErrorMessage(errorData) {
    if (!errorData) return "No se pudo registrar la entrada.";

    if (errorData.errors) {
        const firstKey = Object.keys(errorData.errors)[0];

        if (firstKey && errorData.errors[firstKey] && errorData.errors[firstKey][0]) {
            return errorData.errors[firstKey][0];
        }
    }

    return errorData.message || "No se pudo registrar la entrada.";
}

function getHistorialFiltrado() {
    const desdeValue = filtroDesde ? filtroDesde.value : "";
    const hastaValue = filtroHasta ? filtroHasta.value : "";
    const proveedorValue = filtroProveedorHistorial ? filtroProveedorHistorial.value : "";
    const productoValue = filtroProductoHistorial ? filtroProductoHistorial.value : "";

    const desde = desdeValue ? new Date(`${desdeValue}T00:00:00`) : null;
    const hasta = hastaValue ? new Date(`${hastaValue}T23:59:59`) : null;

    return historialEntradas.filter((item) => {
        const fechaItem = parseDateValue(item.fecha);

        if (desde && (!fechaItem || fechaItem < desde)) return false;
        if (hasta && (!fechaItem || fechaItem > hasta)) return false;
        if (proveedorValue && String(item.id_proveedor || "") !== proveedorValue) return false;
        if (productoValue && String(item.id_producto || "") !== productoValue) return false;

        return true;
    });
}

function renderHistorialFiltros() {
    if (filtroProveedorHistorial) {
        const proveedorOptions = [
            '<option value="">Todos los proveedores</option>',
            ...proveedores.map((p) => `<option value="${p.id_proveedor}">${escapeHtml(p.nombre)} - ${escapeHtml(p.empresa || "Sin empresa")}</option>`),
        ];

        const selectedProveedor = filtroProveedorHistorial.value;
        filtroProveedorHistorial.innerHTML = proveedorOptions.join("");
        filtroProveedorHistorial.value = selectedProveedor;
    }

    if (filtroProductoHistorial) {
        const productoOptions = [
            '<option value="">Todos los productos</option>',
            ...catalogoProductos.map((p) => `<option value="${p.id_producto}">${escapeHtml(p.nombre)}</option>`),
        ];

        const selectedProductoFiltro = filtroProductoHistorial.value;
        filtroProductoHistorial.innerHTML = productoOptions.join("");
        filtroProductoHistorial.value = selectedProductoFiltro;
    }
}

function renderProveedorEntradaOptions() {
    if (!proveedorEntrada) return;

    const proveedoresActivos = proveedores.filter((p) => String(p.estado || "").toLowerCase() === "activo");

    const options = [
        '<option value="">Selecciona un proveedor</option>',
        ...proveedoresActivos.map((p) => `<option value="${p.id_proveedor}">${escapeHtml(p.nombre)} - ${escapeHtml(p.empresa || "Sin empresa")}</option>`),
    ];

    const current = proveedorEntrada.value;
    proveedorEntrada.innerHTML = options.join("");
    const existeEnActivos = proveedoresActivos.some((p) => String(p.id_proveedor) === String(current));
    proveedorEntrada.value = existeEnActivos ? current : "";

    if (kpiProveedores) {
        const activos = proveedores.filter((p) => String(p.estado || "").toLowerCase() === "activo").length;
        kpiProveedores.textContent = String(activos);
    }
}

function renderResultadosProducto(lista) {
    if (!resultadosProducto) return;

    if (!lista.length) {
        resultadosProducto.innerHTML = '<p class="vacio">No se encontraron productos.</p>';
        return;
    }

    resultadosProducto.innerHTML = lista
        .map((producto) => `
            <button type="button" class="item-resultado" data-id="${producto.id_producto}">
                <span>${escapeHtml(producto.nombre)}</span>
                <span class="meta">${escapeHtml(producto.codigo || "Sin código")} | Stock ${escapeHtml(producto.stock || 0)}</span>
            </button>
        `)
        .join("");
}

function renderProductoSeleccionado() {
    if (!selectedProducto) {
        if (infoNombre) infoNombre.textContent = "Ningún producto seleccionado";
        if (infoCodigo) infoCodigo.textContent = "Código: -";
        if (infoPrecioCompra) infoPrecioCompra.textContent = "Precio proveedor: -";
        if (infoStockActual) infoStockActual.textContent = "0";
        if (infoAlertaStock) {
            infoAlertaStock.classList.remove("ok");
            infoAlertaStock.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Selecciona un producto para ver estado de stock';
        }
        return;
    }

    if (infoNombre) {
        const extra = selectedProductosEntrada.length > 1 ? ` +${selectedProductosEntrada.length - 1} más` : "";
        infoNombre.textContent = `${selectedProducto.nombre || "-"}${extra}`;
    }
    if (infoCodigo) infoCodigo.textContent = `Código: ${selectedProducto.codigo || "-"}`;
    if (infoPrecioCompra) infoPrecioCompra.textContent = `Precio proveedor: $${formatMoney(selectedPrecioCompra)}`;
    if (infoStockActual) infoStockActual.textContent = String(selectedProducto.stock || 0);

    if (infoAlertaStock) {
        const stockAlert = getStockAlertText(selectedProducto.stock || 0);
        infoAlertaStock.classList.toggle("ok", stockAlert.ok);
        infoAlertaStock.innerHTML = `<i class="fa-solid ${stockAlert.ok ? "fa-circle-check" : "fa-triangle-exclamation"}"></i> ${escapeHtml(stockAlert.text)}`;
    }
}

function getProductosDelProveedorSeleccionado() {
    const proveedorId = proveedorEntrada ? Number(proveedorEntrada.value || 0) : 0;

    if (!proveedorId) return [];

    return productosProveedorPorId.get(proveedorId) || [];
}

function actualizarTotalEntrada() {
    if (!totalEntrada) return;

    const total = selectedProductosEntrada.reduce((sum, item) => {
        const cantidad = Number(item.cantidad || 0);
        const precio = Number(item.precio_compra || 0);

        if (!Number.isFinite(cantidad) || cantidad <= 0) return sum;
        if (!Number.isFinite(precio) || precio <= 0) return sum;

        return sum + (cantidad * precio);
    }, 0);

    totalEntrada.textContent = `$${formatMoney(total)}`;
}

function renderDetalleProductosEntrada() {
    if (!detalleProductosEntrada) return;

    if (!selectedProductosEntrada.length) {
        detalleProductosEntrada.innerHTML = '<p class="vacio">Selecciona productos para asignar cantidades.</p>';
        return;
    }

    detalleProductosEntrada.innerHTML = selectedProductosEntrada
        .map((item) => `
            <div class="detalle-producto-item">
                <div>
                    <strong>${escapeHtml(item.producto?.nombre || "Producto")}</strong>
                    <span class="meta">Precio: $${escapeHtml(formatMoney(item.precio_compra))}</span>
                    <span class="detalle-subtotal" data-id="${item.id_producto}">Subtotal: $${escapeHtml(formatMoney(Number(item.precio_compra || 0) * Number(item.cantidad || 0)))}</span>
                    <button type="button" class="btn-remove-item" data-id="${item.id_producto}">Quitar</button>
                </div>
                <input
                    type="number"
                    class="input-cantidad-item"
                    data-id="${item.id_producto}"
                    min="1"
                    step="1"
                    value="${escapeHtml(item.cantidad ?? "")}" 
                >
            </div>
        `)
        .join("");
}

function renderProductosProveedorEntrada() {
    if (!productoEntrada) return;

    const proveedorId = proveedorEntrada ? Number(proveedorEntrada.value || 0) : 0;

    if (!proveedorId) {
        productoEntrada.disabled = true;
        productoEntrada.innerHTML = '<option value="">Selecciona un proveedor primero</option>';
        selectedProducto = null;
        selectedPrecioCompra = 0;
        selectedProductosEntrada = [];
        renderProductoSeleccionado();
        renderDetalleProductosEntrada();
        actualizarTotalEntrada();
        return;
    }

    const lista = getProductosDelProveedorSeleccionado();

    if (!lista.length) {
        productoEntrada.disabled = true;
        productoEntrada.innerHTML = '<option value="">Este proveedor no tiene productos asignados</option>';
        selectedProducto = null;
        selectedPrecioCompra = 0;
        selectedProductosEntrada = [];
        renderProductoSeleccionado();
        renderDetalleProductosEntrada();
        actualizarTotalEntrada();
        return;
    }

    productoEntrada.disabled = false;
    productoEntrada.innerHTML = [
        '<option value="">Selecciona un producto</option>',
        ...lista.map((item) => {
            const nombre = item.nombre || "Producto";
            const precio = formatMoney(item.precio_compra);
            const idProducto = Number(item.id_producto || 0);

            return `<option value="${idProducto}">${escapeHtml(nombre)} | $${escapeHtml(precio)}</option>`;
        }),
    ].join("");

    selectedProductosEntrada = [];
    renderDetalleProductosEntrada();
    actualizarTotalEntrada();
}

function agregarProductoEntradaPorId(idProducto) {
    const id = Number(idProducto || 0);
    if (!Number.isFinite(id) || id <= 0) return;

    const proveedorId = proveedorEntrada ? Number(proveedorEntrada.value || 0) : 0;
    if (!proveedorId) return;

    const lista = getProductosDelProveedorSeleccionado();
    const itemProveedor = lista.find((p) => Number(p.id_producto) === id);
    const productoCatalogo = catalogoProductos.find((p) => Number(p.id_producto) === id);

    if (!itemProveedor || !productoCatalogo) return;

    const existe = selectedProductosEntrada.some((item) => Number(item.id_producto) === id);
    if (existe) {
        renderDetalleProductosEntrada();
        actualizarTotalEntrada();
        return;
    }

    selectedProductosEntrada.push({
        id_producto: id,
        producto: productoCatalogo,
        precio_compra: Number(itemProveedor.precio_compra || 0),
        cantidad: "",
    });

    selectedProducto = selectedProductosEntrada[0].producto;
    selectedPrecioCompra = Number(selectedProductosEntrada[0].precio_compra || 0);

    renderProductoSeleccionado();
    renderDetalleProductosEntrada();
    actualizarTotalEntrada();
}

function sincronizarProductoSeleccionadoDesdeSelect() {
    if (!productoEntrada) return;
    const idProducto = Number(productoEntrada.value || 0);
    if (!idProducto) return;
    agregarProductoEntradaPorId(idProducto);
}

function filtrarProductosBusqueda() {
    const term = (buscarProducto ? buscarProducto.value : "").trim().toLowerCase();
    const proveedorId = proveedorEntrada ? Number(proveedorEntrada.value || 0) : 0;
    const permitidos = proveedorId ? productosProveedorPorId.get(proveedorId) || [] : null;
    const permitidosSet = permitidos ? new Set(permitidos.map((item) => Number(item.id_producto))) : null;

    const filtrados = catalogoProductos.filter((producto) => {
        const coincideProveedor = !permitidosSet || permitidosSet.has(Number(producto.id_producto));
        const coincideTexto = !term
            || String(producto.nombre || "").toLowerCase().includes(term)
            || String(producto.codigo || "").toLowerCase().includes(term);

        return coincideProveedor && coincideTexto;
    });

    renderResultadosProducto(filtrados.slice(0, 25));
}

function renderHistorial() {
    if (!tablaHistorialBody || !badgeHistorial || !kpiEntradas) return;

    const historialFiltrado = getHistorialFiltrado();
    const resumenCompras = getResumenCompras(historialFiltrado);
    historialFiltradoActual = resumenCompras;

    if (!resumenCompras.length) {
        tablaHistorialBody.innerHTML = '<tr><td colspan="6" class="vacio">Sin entradas registradas para los filtros aplicados.</td></tr>';
    } else {
        tablaHistorialBody.innerHTML = resumenCompras
            .map((item, index) => `
                <tr>
                    <td>${escapeHtml(formatDateTime(item.fecha))}</td>
                    <td>${escapeHtml(item._items?.length > 1 ? `${item.producto || "-"} +${item._items.length - 1} más` : (item.producto || "-"))}</td>
                    <td>${escapeHtml(item.proveedor || item.proveedor_nombre || "-")}</td>
                    <td><span class="cantidad">${escapeHtml(item._items?.reduce((sum, row) => sum + Number(row.cantidad || 0), 0) || "-")}</span></td>
                    <td>$${escapeHtml(formatMoney(item._total_compra || 0))}</td>
                    <td>
                        <button type="button" class="btn-ver-detalle" data-index="${index}">Ver</button>
                    </td>
                </tr>
            `)
            .join("");
    }

    badgeHistorial.textContent = `${resumenCompras.length} registros`;
    kpiEntradas.textContent = String(resumenCompras.length);

    if (kpiTotalGastado) {
        const totalGastado = resumenCompras.reduce((sum, item) => sum + Number(item._total_compra || 0), 0);
        kpiTotalGastado.textContent = `$${formatMoney(totalGastado)}`;
    }
}

function getItemsDetalleEntrada(item) {
    if (!item) return [];

    const idCompra = Number(item.id_compra || item.compra_id || 0);
    if (!idCompra) return [item];

    const relacionados = historialEntradas.filter((row) => Number(row.id_compra || row.compra_id || 0) === idCompra);
    return relacionados.length ? relacionados : [item];
}

function abrirModalDetalle(item) {
    if (!modalDetalleEntrada || !contenidoDetalleEntrada || !item) return;

    const items = getItemsDetalleEntrada(item);
    const totalCompra = items.reduce((sum, row) => sum + getSubtotalLinea(row), 0);
    const productosDetalle = items
        .map((row) => `
            <tr>
                <td>${escapeHtml(row.producto || "-")}</td>
                <td>${escapeHtml(row.cantidad ?? "-")}</td>
                <td>$${escapeHtml(formatMoney(getPrecioUnitario(row)))}</td>
                <td>$${escapeHtml(formatMoney(getSubtotalLinea(row)))}</td>
            </tr>
        `)
        .join("");

    const campos = [
        { label: "Fecha", value: formatDateTime(item.fecha) },
        { label: "Proveedor", value: item.proveedor || item.proveedor_nombre || "-" },
        { label: "Productos en compra", value: String(items.length) },
        { label: "Total compra", value: `$${formatMoney(totalCompra)}` },
        { label: "Usuario", value: item.usuario || "Admin" },
        { label: "Observacion", value: item.observacion || "-" },
    ];

    const resumenHtml = campos
        .map((campo) => `
            <div class="detalle-campo">
                <strong>${escapeHtml(campo.label)}</strong>
                <span>${escapeHtml(campo.value)}</span>
            </div>
        `)
        .join("");

    const productosHtml = `
        <div class="detalle-campo detalle-campo-full">
            <strong>Productos de la compra</strong>
            <div class="detalle-items-wrap">
                <table class="detalle-items-tabla">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>PU</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productosDetalle}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contenidoDetalleEntrada.innerHTML = `${resumenHtml}${productosHtml}`;

    modalDetalleEntrada.classList.remove("hidden");
}

function cerrarModalDetalle() {
    if (!modalDetalleEntrada) return;
    modalDetalleEntrada.classList.add("hidden");
}

async function cargarUsuarioSesion() {
    try {
        const response = await fetch(`${API_BASE}/me`, {
            method: "GET",
            headers: getHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            throw new Error("No se pudo obtener la sesión");
        }

        const usuario = await response.json();

        if (topbarUsuarioNombre) {
            topbarUsuarioNombre.textContent = usuario.nombre || "Usuario";
        }

        if (topbarUsuarioRol) {
            const rol = usuario.rol && usuario.rol.nombre ? usuario.rol.nombre : "Administrador";
            topbarUsuarioRol.textContent = rol;
        }
    } catch (error) {
        console.error(error);

        if (topbarUsuarioNombre) {
            topbarUsuarioNombre.textContent = "Sin sesión";
        }

        if (topbarUsuarioRol) {
            topbarUsuarioRol.textContent = "Administrador";
        }
    }
}

async function cargarProductosProveedor(idProveedorActual) {
    const response = await fetch(`${API_BASE}/proveedores/${idProveedorActual}/productos`, {
        method: "GET",
        headers: getHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function cargarProveedores() {
    try {
        const response = await fetch(`${API_BASE}/proveedores`, {
            method: "GET",
            headers: getHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            throw new Error("No se pudieron cargar proveedores");
        }

        proveedores = await response.json();
        renderProveedorEntradaOptions();
        renderHistorialFiltros();

        const cargasProductos = proveedores.map(async (proveedor) => {
            try {
                const lista = await cargarProductosProveedor(proveedor.id_proveedor);
                productosProveedorPorId.set(Number(proveedor.id_proveedor), lista);
            } catch (error) {
                console.error(error);
                productosProveedorPorId.set(Number(proveedor.id_proveedor), []);
            }
        });

        await Promise.all(cargasProductos);
        renderProductosProveedorEntrada();
        filtrarProductosBusqueda();
    } catch (error) {
        console.error(error);
    }
}

async function cargarCatalogoProductos() {
    try {
        const response = await fetch(`${API_BASE}/productos`, {
            method: "GET",
            headers: getHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            throw new Error("No se pudieron cargar productos de catálogo");
        }

        catalogoProductos = await response.json();
        renderHistorialFiltros();
        filtrarProductosBusqueda();
    } catch (error) {
        console.error(error);
    }
}

async function cargarEntradas() {
    try {
        const response = await fetch(`${API_BASE}/entradas`, {
            method: "GET",
            headers: getHeaders(),
        });

        if (!response.ok) {
            throw new Error("No se pudo cargar historial de entradas");
        }

        const data = await response.json();
        historialEntradas = data.map((item) => ({
            ...item,
            proveedor: item.proveedor || `${item.proveedor_nombre || ""}${item.proveedor_empresa ? ` - ${item.proveedor_empresa}` : ""}`.trim(),
            producto: item.producto || "-",
            id_producto: item.id_producto || null,
            cantidad: item.cantidad ?? "-",
            observacion: item.observacion || "-",
            usuario: "Admin",
        }));
        renderHistorialFiltros();
        renderHistorial();
    } catch (error) {
        console.error(error);
    }
}

async function registrarEntrada(payload) {
    const response = await fetch(`${API_BASE}/entradas`, {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }

    return data;
}

if (buscarProducto) {
    buscarProducto.addEventListener("input", filtrarProductosBusqueda);
}

if (proveedorEntrada) {
    proveedorEntrada.addEventListener("change", async () => {
        const proveedorId = Number(proveedorEntrada.value || 0);

        if (proveedorId && !productosProveedorPorId.has(proveedorId)) {
            try {
                const lista = await cargarProductosProveedor(proveedorId);
                productosProveedorPorId.set(proveedorId, lista);
            } catch (error) {
                console.error(error);
            }
        }

        if (selectedProducto && proveedorId) {
            const lista = productosProveedorPorId.get(proveedorId) || [];
            const existe = lista.some((item) => Number(item.id_producto) === Number(selectedProducto.id_producto));

            if (!existe) {
                selectedProducto = null;
                renderProductoSeleccionado();
            }
        }

        renderProductosProveedorEntrada();
        sincronizarProductoSeleccionadoDesdeSelect();
        filtrarProductosBusqueda();
    });
}

if (btnAgregarProductoEntrada) {
    btnAgregarProductoEntrada.addEventListener("click", () => {
        sincronizarProductoSeleccionadoDesdeSelect();
    });
}

if (detalleProductosEntrada) {
    detalleProductosEntrada.addEventListener("click", (event) => {
        const button = event.target.closest("button.btn-remove-item[data-id]");
        if (!button) return;

        const idProducto = Number(button.dataset.id || 0);
        selectedProductosEntrada = selectedProductosEntrada.filter((item) => Number(item.id_producto) !== idProducto);

        if (!selectedProductosEntrada.length) {
            selectedProducto = null;
            selectedPrecioCompra = 0;
        } else {
            selectedProducto = selectedProductosEntrada[0].producto;
            selectedPrecioCompra = Number(selectedProductosEntrada[0].precio_compra || 0);
        }

        renderProductoSeleccionado();
        renderDetalleProductosEntrada();
        actualizarTotalEntrada();
    });

    detalleProductosEntrada.addEventListener("input", (event) => {
        const input = event.target.closest("input.input-cantidad-item[data-id]");
        if (!input) return;

        const idProducto = Number(input.dataset.id || 0);
        const texto = String(input.value ?? "");
        const cantidad = Number(texto);

        selectedProductosEntrada = selectedProductosEntrada.map((item) => {
            if (Number(item.id_producto) !== idProducto) return item;
            return {
                ...item,
                cantidad: texto === "" ? "" : (Number.isFinite(cantidad) && cantidad > 0 ? Math.floor(cantidad) : 0),
            };
        });

        const itemActual = selectedProductosEntrada.find((item) => Number(item.id_producto) === idProducto);
        const subtotalNode = detalleProductosEntrada.querySelector(`.detalle-subtotal[data-id="${idProducto}"]`);

        if (itemActual && subtotalNode) {
            const subtotal = Number(itemActual.precio_compra || 0) * Number(itemActual.cantidad || 0);
            subtotalNode.textContent = `Subtotal: $${formatMoney(subtotal)}`;
        }

        actualizarTotalEntrada();
    });
}

if (tablaHistorialBody) {
    tablaHistorialBody.addEventListener("click", (event) => {
        const button = event.target.closest("button.btn-ver-detalle[data-index]");
        if (!button) return;

        const idx = Number(button.dataset.index || -1);
        const item = idx >= 0 ? historialFiltradoActual[idx] : null;
        if (!item) return;

        abrirModalDetalle(item);
    });
}

if (btnCerrarModalDetalle) {
    btnCerrarModalDetalle.addEventListener("click", cerrarModalDetalle);
}

if (modalDetalleEntrada) {
    modalDetalleEntrada.addEventListener("click", (event) => {
        if (event.target === modalDetalleEntrada) {
            cerrarModalDetalle();
        }
    });
}

if (resultadosProducto) {
    resultadosProducto.addEventListener("click", (event) => {
        const button = event.target.closest("button.item-resultado[data-id]");

        if (!button) return;

        const id = Number(button.dataset.id);
        const producto = catalogoProductos.find((item) => Number(item.id_producto) === id);

        if (!producto) return;

        agregarProductoEntradaPorId(id);
    });
}

if (btnRegistrarEntrada) {
    btnRegistrarEntrada.addEventListener("click", async () => {
        if (!mensajeEntrada) return;

        const proveedorId = proveedorEntrada ? Number(proveedorEntrada.value || 0) : 0;
        const observacion = observacionEntrada ? observacionEntrada.value.trim() : "";

        if (!selectedProductosEntrada.length) {
            mensajeEntrada.textContent = "Selecciona al menos un producto para registrar la entrada.";
            mensajeEntrada.style.color = "#b42318";
            return;
        }

        if (!proveedorId) {
            mensajeEntrada.textContent = "Selecciona un proveedor.";
            mensajeEntrada.style.color = "#b42318";
            return;
        }

        const cantidadInvalida = selectedProductosEntrada.some((item) => {
            const cantidad = Number(item.cantidad || 0);
            return !Number.isFinite(cantidad) || cantidad <= 0;
        });

        if (cantidadInvalida) {
            mensajeEntrada.textContent = "Cada producto debe tener cantidad valida mayor a 0.";
            mensajeEntrada.style.color = "#b42318";
            return;
        }

        try {
            mensajeEntrada.textContent = "Registrando entrada...";
            mensajeEntrada.style.color = "#64748b";

            const entrada = await registrarEntrada({
                id_proveedor: proveedorId,
                items: selectedProductosEntrada.map((item) => ({
                    id_producto: item.id_producto,
                    cantidad: Number(item.cantidad),
                })),
                observacion: observacion || null,
            });

            const actualizados = Array.isArray(entrada.items) ? entrada.items : [];
            actualizados.forEach((item) => {
                const producto = catalogoProductos.find((p) => Number(p.id_producto) === Number(item.id_producto));
                if (producto) {
                    producto.stock = item.stock_nuevo;
                }
            });

            if (actualizados.length) {
                actualizados.forEach((item) => {
                    historialEntradas.unshift({
                        ...entrada,
                        id_producto: item.id_producto,
                        producto: item.producto,
                        cantidad: item.cantidad,
                        precio_compra: item.precio_compra,
                        total: item.subtotal,
                        usuario: "Admin",
                    });
                });
            } else {
                historialEntradas.unshift({
                    ...entrada,
                    usuario: "Admin",
                });
            }

            renderHistorialFiltros();
            renderHistorial();
            filtrarProductosBusqueda();

            selectedProductosEntrada = [];
            if (observacionEntrada) observacionEntrada.value = "";
            renderDetalleProductosEntrada();
            actualizarTotalEntrada();
            renderProductoSeleccionado();

            mensajeEntrada.textContent = "Entrada registrada correctamente.";
            mensajeEntrada.style.color = "#1e7e34";
        } catch (errorData) {
            mensajeEntrada.style.color = "#b42318";
            mensajeEntrada.textContent = getErrorMessage(errorData);
        }
    });
}

[filtroDesde, filtroHasta, filtroProveedorHistorial, filtroProductoHistorial].forEach((input) => {
    if (!input) return;

    input.addEventListener("change", () => {
        renderHistorial();
    });
});

void Promise.all([cargarUsuarioSesion(), cargarCatalogoProductos(), cargarProveedores(), cargarEntradas()]).then(() => {
    renderProductosProveedorEntrada();
    sincronizarProductoSeleccionadoDesdeSelect();
    actualizarTotalEntrada();
    filtrarProductosBusqueda();
    renderProductoSeleccionado();
    renderHistorial();
});

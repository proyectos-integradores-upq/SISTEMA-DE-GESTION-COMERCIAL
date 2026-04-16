const API_BASE = "http://127.0.0.1:8000/api";
const token = localStorage.getItem("token");

const formProveedor = document.getElementById("formProveedor");
const idProveedor = document.getElementById("idProveedor");
const proveedorNombre = document.getElementById("proveedorNombre");
const proveedorEmpresa = document.getElementById("proveedorEmpresa");
const proveedorTelefono = document.getElementById("proveedorTelefono");
const proveedorCorreo = document.getElementById("proveedorCorreo");
const proveedorRfc = document.getElementById("proveedorRfc");
const proveedorEstadoWrap = document.getElementById("proveedorEstadoWrap");
const proveedorEstado = document.getElementById("proveedorEstado");
const proveedorDireccion = document.getElementById("proveedorDireccion");
const mensajeProveedor = document.getElementById("mensajeProveedor");
const listaProveedores = document.getElementById("listaProveedores");
const contadorProveedores = document.getElementById("contadorProveedores");
const kpiProveedores = document.getElementById("kpiProveedores");
const kpiCobertura = document.getElementById("kpiCobertura");
const kpiCoberturaTexto = document.getElementById("kpiCoberturaTexto");
const btnGuardarProveedor = document.getElementById("btnGuardarProveedor");
const btnCancelarProveedor = document.getElementById("btnCancelarProveedor");
const checkProductos = document.getElementById("checkProductos");
const topbarUsuarioNombre = document.getElementById("topbarUsuarioNombre");
const topbarUsuarioRol = document.getElementById("topbarUsuarioRol");

let proveedores = [];
let catalogoProductos = [];
const productosProveedorPorId = new Map();

if (!token) {
    window.location.href = "login.html";
}

function getHeaders(json = false) {
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
    };

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

function normalizarEstado(estado) {
    const valor = String(estado || "").trim().toLowerCase();
    return valor === "inactivo" ? "Inactivo" : "Activo";
}

async function parseApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();

    if (response.status === 401) {
        return { message: "Sesión expirada. Inicia sesión nuevamente." };
    }

    if (!response.ok) {
        return {
            message: "La API devolvió una respuesta no válida. Verifica sesión y logs del servidor.",
            raw: text,
        };
    }

    return { message: text };
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

function getEstadoClass(estado) {
    if ((estado || "").toLowerCase() === "activo") return "estado activo";
    return "estado";
}

function formatMoney(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function mostrarMensaje(texto, ok = false) {
    if (!mensajeProveedor) return;

    mensajeProveedor.textContent = texto;
    mensajeProveedor.style.color = ok ? "#1e7e34" : "#b42318";
}

function getErrorMessage(errorData) {
    if (!errorData) return "Error al guardar proveedor.";

    if (errorData.errors) {
        const firstKey = Object.keys(errorData.errors)[0];

        if (firstKey && errorData.errors[firstKey] && errorData.errors[firstKey][0]) {
            return errorData.errors[firstKey][0];
        }
    }

    return errorData.message || "No se pudo guardar el proveedor.";
}

function renderCheckProductos(seleccion = new Map()) {
    if (!checkProductos) return;

    if (!catalogoProductos.length) {
        checkProductos.innerHTML = '<p class="vacio">No hay productos disponibles en el catálogo.</p>';
        return;
    }

    checkProductos.innerHTML = catalogoProductos
        .map((producto) => {
            const productoId = Number(producto.id_producto);
            const checked = seleccion.has(productoId);
            const precio = checked ? seleccion.get(productoId) : "";

            return `
                <div class="check-item check-item-producto">
                    <label class="check-label-producto">
                        <input type="checkbox" data-id="${productoId}" ${checked ? "checked" : ""}>
                        <span>${escapeHtml(producto.nombre)}</span>
                    </label>
                    <small class="check-meta">${escapeHtml(producto.codigo || "")}</small>
                    <input
                        type="number"
                        class="input-precio-compra"
                        data-id="${productoId}"
                        min="0"
                        step="0.01"
                        placeholder="Precio compra"
                        value="${escapeHtml(precio)}"
                        ${checked ? "" : "disabled"}
                    >
                </div>
            `;
        })
        .join("");
}

function obtenerProductosSeleccionados() {
    if (!checkProductos) return { productos: [], error: null };

    const checkboxes = Array.from(checkProductos.querySelectorAll('input[type="checkbox"][data-id]'));
    const productos = [];

    for (const checkbox of checkboxes) {
        if (!checkbox.checked) continue;

        const idProducto = Number(checkbox.dataset.id);
        const precioInput = checkProductos.querySelector(`.input-precio-compra[data-id="${idProducto}"]`);
        const precio = precioInput ? Number(precioInput.value) : NaN;

        if (!Number.isFinite(precio) || precio <= 0) {
            return {
                productos: [],
                error: "Cada producto seleccionado debe tener precio de compra mayor a 0.",
            };
        }

        productos.push({
            id_producto: idProducto,
            precio_compra: Number(precio.toFixed(2)),
        });
    }

    return { productos, error: null };
}

function isProveedorFormCompleto() {
    const nombreOk = proveedorNombre && proveedorNombre.value.trim().length > 0;
    const empresaOk = proveedorEmpresa && proveedorEmpresa.value.trim().length > 0;
    const seleccion = obtenerProductosSeleccionados();

    return Boolean(nombreOk && empresaOk && !seleccion.error && seleccion.productos.length > 0);
}

function actualizarEstadoBotonProveedor() {
    if (!btnGuardarProveedor) return;

    const ready = isProveedorFormCompleto();
    btnGuardarProveedor.classList.toggle("is-ready", ready);
}

function actualizarVisibilidadEstadoProveedor(enEdicion) {
    if (!proveedorEstadoWrap || !proveedorEstado) return;

    proveedorEstadoWrap.hidden = !enEdicion;
    proveedorEstado.disabled = !enEdicion;

    if (!enEdicion) {
        proveedorEstado.value = "Activo";
    }
}

function updateCoberturaKpi() {
    if (!kpiCobertura || !kpiCoberturaTexto) return;

    const totalProductos = catalogoProductos.length;
    const cubiertos = new Set();

    for (const lista of productosProveedorPorId.values()) {
        lista.forEach((item) => cubiertos.add(Number(item.id_producto)));
    }

    const totalCubiertos = cubiertos.size;
    const porcentaje = totalProductos > 0 ? Math.round((totalCubiertos * 100) / totalProductos) : 0;

    kpiCobertura.textContent = `${porcentaje}%`;
    kpiCoberturaTexto.textContent = `${totalCubiertos} de ${totalProductos} productos cubiertos`;
}

function renderProveedores() {
    if (!listaProveedores) return;

    if (!proveedores.length) {
        listaProveedores.innerHTML = '<p class="vacio">Aún no hay proveedores registrados.</p>';
    } else {
        listaProveedores.innerHTML = proveedores
            .map((proveedor) => `
                <article class="proveedor-item">
                    <h5>${escapeHtml(proveedor.nombre)}</h5>
                    <p><strong>Empresa:</strong> ${escapeHtml(proveedor.empresa || "-")}</p>
                    <p><strong>Teléfono:</strong> ${escapeHtml(proveedor.telefono || "-")}</p>
                    <p><strong>Correo:</strong> ${escapeHtml(proveedor.correo || "-")}</p>
                    <p><strong>Dirección:</strong> ${escapeHtml(proveedor.direccion || "-")}</p>
                    <p><strong>RFC:</strong> ${escapeHtml(proveedor.rfc || "-")}</p>
                    <p><strong>Productos asignados:</strong> ${escapeHtml(proveedor.productos_proveedor_count || 0)}</p>
                    <span class="${getEstadoClass(proveedor.estado)}">${escapeHtml(proveedor.estado || "Activo")}</span>
                    <div class="acciones-proveedor">
                        <button type="button" class="btn-edit-proveedor" data-action="editar" data-id="${proveedor.id_proveedor}">Editar</button>
                        <button type="button" class="btn-delete-proveedor" data-action="eliminar" data-id="${proveedor.id_proveedor}">Eliminar</button>
                    </div>
                </article>
            `)
            .join("");
    }

    if (contadorProveedores) {
        contadorProveedores.textContent = String(proveedores.length);
    }

    if (kpiProveedores) {
        const activos = proveedores.filter((p) => String(p.estado || "").toLowerCase() === "activo").length;
        kpiProveedores.textContent = String(activos);
    }
}

function resetFormProveedor() {
    if (!formProveedor) return;

    formProveedor.reset();
    if (idProveedor) idProveedor.value = "";
    if (proveedorEstado) proveedorEstado.value = "Activo";

    if (btnGuardarProveedor) {
        btnGuardarProveedor.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Registrar proveedor';
    }

    if (btnCancelarProveedor) {
        btnCancelarProveedor.hidden = true;
    }

    actualizarVisibilidadEstadoProveedor(false);

    renderCheckProductos();
    actualizarEstadoBotonProveedor();
}

async function cargarProveedorEnFormulario(proveedor) {
    if (!proveedor) return;

    if (idProveedor) idProveedor.value = String(proveedor.id_proveedor);
    if (proveedorNombre) proveedorNombre.value = proveedor.nombre || "";
    if (proveedorEmpresa) proveedorEmpresa.value = proveedor.empresa || "";
    if (proveedorTelefono) proveedorTelefono.value = proveedor.telefono || "";
    if (proveedorCorreo) proveedorCorreo.value = proveedor.correo || "";
    if (proveedorRfc) proveedorRfc.value = proveedor.rfc || "";
    if (proveedorEstado) proveedorEstado.value = normalizarEstado(proveedor.estado);
    if (proveedorDireccion) proveedorDireccion.value = proveedor.direccion || "";

    if (btnGuardarProveedor) {
        btnGuardarProveedor.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios';
    }

    if (btnCancelarProveedor) {
        btnCancelarProveedor.hidden = false;
    }

    actualizarVisibilidadEstadoProveedor(true);

    const toSeleccionMap = (lista) => {
        const seleccion = new Map();

        lista.forEach((item) => {
            if (item && item.id_producto) {
                seleccion.set(Number(item.id_producto), formatMoney(item.precio_compra));
            }
        });

        return seleccion;
    };

    // Carga inmediata desde cache para que el formulario se pinte al instante.
    const cached = productosProveedorPorId.get(Number(proveedor.id_proveedor)) || [];
    renderCheckProductos(toSeleccionMap(cached));
    actualizarEstadoBotonProveedor();

    try {
        const productos = await cargarProductosProveedor(proveedor.id_proveedor);
        productosProveedorPorId.set(Number(proveedor.id_proveedor), Array.isArray(productos) ? productos : []);
        renderCheckProductos(toSeleccionMap(Array.isArray(productos) ? productos : []));
    } catch (error) {
        console.error(error);
        if (!cached.length) {
            mostrarMensaje("No se pudieron cargar los productos del proveedor.");
        }
    }

    actualizarEstadoBotonProveedor();

    if (proveedorNombre) {
        proveedorNombre.focus();
    }
}

async function crearProveedor(payload) {
    const response = await fetch(`${API_BASE}/proveedores`, {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
    });

    const data = await parseApiResponse(response);

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function actualizarProveedor(id, payload) {
    const response = await fetch(`${API_BASE}/proveedores/${id}`, {
        method: "PUT",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
    });

    const data = await parseApiResponse(response);

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function eliminarProveedor(id) {
    const response = await fetch(`${API_BASE}/proveedores/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
    });

    const data = await parseApiResponse(response);

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function cargarProductosProveedor(idProveedorActual) {
    const response = await fetch(`${API_BASE}/proveedores/${idProveedorActual}/productos`, {
        method: "GET",
        headers: getHeaders(),
    });

    const data = await parseApiResponse(response);

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function syncProductosProveedor(idProveedorActual, productos) {
    const response = await fetch(`${API_BASE}/proveedores/${idProveedorActual}/productos`, {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify({ productos }),
    });

    const data = await parseApiResponse(response);

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
        renderProveedores();

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
        updateCoberturaKpi();
    } catch (error) {
        console.error(error);
        if (listaProveedores) {
            listaProveedores.innerHTML = '<p class="vacio">Error al cargar proveedores.</p>';
        }
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
        renderCheckProductos();
        actualizarEstadoBotonProveedor();
    } catch (error) {
        console.error(error);
        if (checkProductos) {
            checkProductos.innerHTML = '<p class="vacio">Error al cargar productos del catálogo.</p>';
        }
    }
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

if (formProveedor) {
    [proveedorNombre, proveedorEmpresa].forEach((input) => {
        if (!input) return;

        input.addEventListener("input", actualizarEstadoBotonProveedor);
    });

    if (checkProductos) {
        checkProductos.addEventListener("change", (event) => {
            const checkbox = event.target.closest('input[type="checkbox"][data-id]');

            if (checkbox) {
                const idProducto = Number(checkbox.dataset.id);
                const precioInput = checkProductos.querySelector(`.input-precio-compra[data-id="${idProducto}"]`);

                if (precioInput) {
                    precioInput.disabled = !checkbox.checked;
                    if (!checkbox.checked) {
                        precioInput.value = "";
                    } else if (!precioInput.value) {
                        precioInput.value = "0.01";
                    }
                }
            }

            actualizarEstadoBotonProveedor();
        });

        checkProductos.addEventListener("input", (event) => {
            if (event.target.closest(".input-precio-compra")) {
                actualizarEstadoBotonProveedor();
            }
        });
    }

    formProveedor.addEventListener("submit", async (event) => {
        event.preventDefault();

        const proveedorId = idProveedor ? idProveedor.value.trim() : "";

        const payload = {
            nombre: proveedorNombre ? proveedorNombre.value.trim() : "",
            empresa: proveedorEmpresa ? proveedorEmpresa.value.trim() : "",
            telefono: proveedorTelefono ? proveedorTelefono.value.trim() || null : null,
            correo: proveedorCorreo ? proveedorCorreo.value.trim() || null : null,
            direccion: proveedorDireccion ? proveedorDireccion.value.trim() || null : null,
            rfc: proveedorRfc ? proveedorRfc.value.trim() || null : null,
            estado: proveedorId ? normalizarEstado(proveedorEstado ? proveedorEstado.value : "Activo") : "Activo",
        };

        if (!payload.nombre || !payload.empresa) {
            mostrarMensaje("Nombre y empresa son obligatorios.");
            return;
        }

        const seleccion = obtenerProductosSeleccionados();

        if (seleccion.error) {
            mostrarMensaje(seleccion.error);
            return;
        }

        if (!seleccion.productos.length) {
            mostrarMensaje("Selecciona al menos un producto del catálogo para el proveedor.");
            return;
        }

        try {
            mostrarMensaje(proveedorId ? "Actualizando proveedor..." : "Guardando proveedor...");

            let proveedorGuardadoId = Number(proveedorId);

            if (proveedorId) {
                await actualizarProveedor(proveedorId, payload);
            } else {
                const nuevoProveedor = await crearProveedor(payload);
                proveedorGuardadoId = Number(nuevoProveedor.id_proveedor);
            }

            await syncProductosProveedor(proveedorGuardadoId, seleccion.productos);
            mostrarMensaje(proveedorId ? "Proveedor actualizado correctamente." : "Proveedor registrado correctamente.", true);

            resetFormProveedor();
            await cargarProveedores();
        } catch (errorData) {
            mostrarMensaje(getErrorMessage(errorData));
        }
    });
}

if (btnCancelarProveedor) {
    btnCancelarProveedor.addEventListener("click", () => {
        resetFormProveedor();
        mostrarMensaje("Edicion cancelada.", true);
    });
}

if (listaProveedores) {
    listaProveedores.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = Number(button.dataset.id);
        const proveedor = proveedores.find((item) => Number(item.id_proveedor) === id);

        if (!proveedor) {
            mostrarMensaje("No se encontró el proveedor seleccionado.");
            return;
        }

        if (action === "editar") {
            await cargarProveedorEnFormulario(proveedor);
            mostrarMensaje("Edita los datos y guarda cambios.", true);
            return;
        }

        if (action === "eliminar") {
            const confirmar = confirm(`¿Eliminar proveedor ${proveedor.nombre}?`);

            if (!confirmar) return;

            try {
                const resultado = await eliminarProveedor(id);
                mostrarMensaje(resultado?.message || "Accion ejecutada correctamente.", true);
                resetFormProveedor();
                await cargarProveedores();
            } catch (errorData) {
                mostrarMensaje(getErrorMessage(errorData));
            }
        }
    });
}

void Promise.all([cargarUsuarioSesion(), cargarCatalogoProductos(), cargarProveedores()]).then(() => {
    updateCoberturaKpi();
    actualizarVisibilidadEstadoProveedor(false);
});
actualizarEstadoBotonProveedor();

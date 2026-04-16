import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getApiCandidates } from "../config/api";
import { clearSession, getStoredToken } from "../utils/authStorage";

const FACTURACION_DEFAULTS = {
	emisor_nombre: "VentaTotal SA de CV",
	emisor_rfc: "AAA010101AAA",
	emisor_codigo_postal: "64000",
	emisor_regimen_fiscal: "601 General de Ley Personas Morales",
	forma_pago: "01 Efectivo",
	metodo_pago_cfdi: "PUE Pago en una sola exhibicion",
	moneda: "MXN",
	lugar_expedicion: "Monterrey, Nuevo Leon",
	clave_producto: "01010101",
	clave_unidad: "H87"
};

function crearFormularioFacturacionInicial() {
	return {
		nombre_cliente: "Público General",
		correo: "",
		telefono: "",
		rfc: "XAXX010101000",
		razon_social: "Público General"
	};
}

export default function VentasScreen({ navigation }) {
	const [apiBaseUrl, setApiBaseUrl] = useState("");
	const [productos, setProductos] = useState([]);
	const [busqueda, setBusqueda] = useState("");
	const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");
	const [cargando, setCargando] = useState(true);
	const [errorCarga, setErrorCarga] = useState("");
	const [historialVentas, setHistorialVentas] = useState([]);
	const [cargandoHistorial, setCargandoHistorial] = useState(true);
	const [errorHistorial, setErrorHistorial] = useState("");
	const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
	const [detalleVentaActual, setDetalleVentaActual] = useState(null);
	const [cargandoDetalleVenta, setCargandoDetalleVenta] = useState(false);
	const [errorDetalleVenta, setErrorDetalleVenta] = useState("");
	const [procesandoAccionVenta, setProcesandoAccionVenta] = useState(false);
	const [modalFacturacionVisible, setModalFacturacionVisible] = useState(false);
	const [ventaFacturacionId, setVentaFacturacionId] = useState(null);
	const [guardandoFacturacion, setGuardandoFacturacion] = useState(false);
	const [formFacturacion, setFormFacturacion] = useState(crearFormularioFacturacionInicial);
	const [carrito, setCarrito] = useState({});
	const [metodoPago, setMetodoPago] = useState("Efectivo");

	const resolverApiBase = useCallback(async () => {
		const candidatos = getApiCandidates();

		for (const baseUrl of candidatos) {
			try {
				const response = await fetch(`${baseUrl}/api/test`, { method: "GET" });
				if (response.ok) {
					return baseUrl;
				}
			} catch {
				// Intenta siguiente URL base.
			}
		}

		throw new Error("No se pudo conectar con la API");
	}, []);

	const resolverImagen = useCallback((producto) => {
		if (producto?.imagen) {
			const limpia = String(producto.imagen).replace(/^\/+/, "");
			return apiBaseUrl ? `${apiBaseUrl}/storage/${limpia}` : null;
		}

		if (producto?.imagen_url) {
			const imagenUrl = String(producto.imagen_url);

			if (imagenUrl.startsWith("http://") || imagenUrl.startsWith("https://")) {
				const marcadorStorage = "/storage/";
				const indiceStorage = imagenUrl.indexOf(marcadorStorage);

				if (indiceStorage !== -1 && apiBaseUrl) {
					const rutaStorage = imagenUrl.substring(indiceStorage);
					return `${apiBaseUrl}${rutaStorage}`;
				}

				return imagenUrl;
			}

			if (apiBaseUrl) {
				return `${apiBaseUrl}${imagenUrl.startsWith("/") ? "" : "/"}${imagenUrl}`;
			}
		}

		return null;
	}, [apiBaseUrl]);

	const cargarProductos = useCallback(async () => {
		setCargando(true);
		setErrorCarga("");

		try {
			const token = await getStoredToken();

			if (!token) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const baseUrl = apiBaseUrl || (await resolverApiBase());
			setApiBaseUrl(baseUrl);

			const response = await fetch(`${baseUrl}/api/productos`, {
				method: "GET",
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${token}`
				}
			});

			if (response.status === 401) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			if (!response.ok) {
				throw new Error("No se pudieron cargar productos");
			}

			const data = await response.json();
			const lista = Array.isArray(data) ? data : [];

			setProductos(lista.filter((item) => Number(item?.stock || 0) > 0));

			setCargandoHistorial(true);
			setErrorHistorial("");

			try {
				const responseVentas = await fetch(`${baseUrl}/api/ventas`, {
					method: "GET",
					headers: {
						Accept: "application/json",
						Authorization: `Bearer ${token}`
					}
				});

				if (responseVentas.status === 401) {
					await clearSession();
					navigation.replace("Login");
					return;
				}

				if (!responseVentas.ok) {
					throw new Error("No se pudo cargar historial");
				}

				const dataVentas = await responseVentas.json();
				setHistorialVentas(Array.isArray(dataVentas) ? dataVentas : []);
			} catch {
				setErrorHistorial("No se pudo cargar el historial de ventas.");
				setHistorialVentas([]);
			} finally {
				setCargandoHistorial(false);
			}
		} catch {
			setErrorCarga("No se pudo cargar el inventario de productos.");
		} finally {
			setCargando(false);
		}
	}, [apiBaseUrl, navigation, resolverApiBase]);

	useEffect(() => {
		void cargarProductos();
	}, [cargarProductos]);

	const categorias = useMemo(() => {
		const values = new Set();
		productos.forEach((item) => {
			const categoria = String(item?.categoria?.nombre || "Sin categoría");
			values.add(categoria);
		});

		return ["TODAS", ...Array.from(values).sort((a, b) => a.localeCompare(b, "es"))];
	}, [productos]);

	const productosFiltrados = useMemo(() => {
		const texto = busqueda.trim().toLowerCase();

		return productos.filter((item) => {
			const nombre = String(item?.nombre || "").toLowerCase();
			const codigo = String(item?.codigo || "").toLowerCase();
			const categoria = String(item?.categoria?.nombre || "Sin categoría");
			const coincideCategoria = categoriaFiltro === "TODAS" || categoria === categoriaFiltro;

			return coincideCategoria && (!texto || nombre.includes(texto) || codigo.includes(texto));
		});
	}, [busqueda, categoriaFiltro, productos]);

	const getCantidadEnCarrito = useCallback((idProducto) => {
		return Number(carrito[String(idProducto)] || 0);
	}, [carrito]);

	const agregarProducto = useCallback((producto) => {
		const key = String(producto.id_producto);
		const cantidadActual = Number(carrito[key] || 0);
		const stock = Number(producto.stock || 0);

		if (cantidadActual >= stock) {
			Alert.alert("Stock", "No puedes agregar más unidades que el stock disponible.");
			return;
		}

		setCarrito((prev) => ({
			...prev,
			[key]: cantidadActual + 1
		}));
	}, [carrito]);

	const cambiarCantidad = useCallback((idProducto, delta) => {
		const producto = productos.find((item) => Number(item.id_producto) === Number(idProducto));
		if (!producto) return;

		const key = String(idProducto);
		const actual = Number(carrito[key] || 0);
		const siguiente = actual + delta;
		const stock = Number(producto.stock || 0);

		if (siguiente <= 0) {
			setCarrito((prev) => {
				const next = { ...prev };
				delete next[key];
				return next;
			});
			return;
		}

		if (siguiente > stock) {
			Alert.alert("Stock", "No hay suficientes unidades disponibles.");
			return;
		}

		setCarrito((prev) => ({
			...prev,
			[key]: siguiente
		}));
	}, [carrito, productos]);

	const limpiarCarrito = useCallback(() => {
		setCarrito({});
	}, []);

	const carritoItems = useMemo(() => {
		return Object.entries(carrito)
			.map(([id, cantidad]) => {
				const producto = productos.find((item) => Number(item.id_producto) === Number(id));
				if (!producto) return null;

				const precio = Number(producto.precio || 0);
				const cantidadNum = Number(cantidad || 0);

				return {
					id_producto: Number(id),
					nombre: producto.nombre || "Producto",
					precio,
					cantidad: cantidadNum,
					subtotal: precio * cantidadNum
				};
			})
			.filter(Boolean);
	}, [carrito, productos]);

	const totalProductosCarrito = carritoItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
	const subtotalCarrito = carritoItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
	const ivaCarrito = subtotalCarrito * 0.16;
	const totalCarrito = subtotalCarrito + ivaCarrito;
	const ventaLista = totalProductosCarrito > 0;

	const ventasAgrupadas = useMemo(() => {
		const grupos = new Map();

		historialVentas.forEach((item, index) => {
			const idVenta = Number(item?.id_venta || 0);
			const key = idVenta > 0 ? `v-${idVenta}` : `d-${item?.id_detalle || index}`;

			if (!grupos.has(key)) {
				grupos.set(key, {
					key,
					id_venta: idVenta || null,
					fecha: item?.fecha || "-",
					metodo_pago: item?.metodo_pago || "-",
					cliente: item?.cliente || "Público General",
					totalArticulos: 0,
					total: Number(item?.total || 0),
					esta_facturada: Number(item?.esta_facturada || 0) === 1 || Number(item?.id_dato_fiscal || 0) > 0
				});
			}

			const grupo = grupos.get(key);
			const subtotalItem = Number(item?.subtotal || 0);
			grupo.totalArticulos += Number(item?.cantidad || 0);
			grupo.esta_facturada = grupo.esta_facturada
				|| Number(item?.esta_facturada || 0) === 1
				|| Number(item?.id_dato_fiscal || 0) > 0;

			if (!Number.isFinite(grupo.total) || grupo.total <= 0) {
				grupo.total = (Number(grupo.total || 0) + subtotalItem);
			}
		});

		return Array.from(grupos.values())
			.sort((a, b) => Number(b.id_venta || 0) - Number(a.id_venta || 0))
			.slice(0, 12);
	}, [historialVentas]);

	const abrirDetalleVenta = useCallback(async (idVenta) => {
		const id = Number(idVenta || 0);
		if (!id) {
			Alert.alert("Ventas", "ID de venta inválido.");
			return;
		}

		setModalDetalleVisible(true);
		setCargandoDetalleVenta(true);
		setErrorDetalleVenta("");
		setDetalleVentaActual(null);

		try {
			const token = await getStoredToken();

			if (!token) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const baseUrl = apiBaseUrl || (await resolverApiBase());
			setApiBaseUrl(baseUrl);

			const response = await fetch(`${baseUrl}/api/ventas/${id}/detalle`, {
				method: "GET",
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${token}`
				}
			});

			if (response.status === 401) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			if (!response.ok) {
				throw new Error("No se pudo cargar el detalle completo");
			}

			const data = await response.json();
			setDetalleVentaActual(data);
		} catch {
			setErrorDetalleVenta("No se pudo cargar el detalle de esta venta.");
		} finally {
			setCargandoDetalleVenta(false);
		}
	}, [apiBaseUrl, navigation, resolverApiBase]);

	const confirmarVenta = useCallback(async () => {
		if (!carritoItems.length) {
			Alert.alert("Ventas", "Agrega productos al carrito para continuar.");
			return;
		}

		try {
			const token = await getStoredToken();

			if (!token) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const baseUrl = apiBaseUrl || (await resolverApiBase());
			setApiBaseUrl(baseUrl);

			const payload = {
				metodo_pago: metodoPago,
				items: carritoItems.map((item) => ({
					id_producto: Number(item.id_producto),
					cantidad: Number(item.cantidad),
					precio_compra: Number(item.precio)
				}))
			};

			const response = await fetch(`${baseUrl}/api/ventas`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(payload)
			});

			if (response.status === 401) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const data = await response.json();

			if (!response.ok) {
				Alert.alert("Ventas", data?.message || "No se pudo registrar la venta.");
				return;
			}

			setCarrito({});
			await cargarProductos();
			Alert.alert("Venta registrada", `Venta #${data?.id_venta || "N/A"} guardada correctamente.`);
		} catch {
			Alert.alert("Ventas", "Error de conexión al registrar la venta.");
		}
	}, [apiBaseUrl, carritoItems, cargarProductos, metodoPago, navigation, resolverApiBase]);

	const formatearMoneda = useCallback((valor) => {
		return `$${Number(valor || 0).toFixed(2)}`;
	}, []);

	const construirFacturaHtml = useCallback((factura) => {
		const detalle = Array.isArray(factura?.detalle) ? factura.detalle : [];
		const filas = detalle.map((item) => `
			<tr>
				<td>${item?.producto || "Producto"}</td>
				<td>${Number(item?.cantidad || 0)}</td>
				<td>${formatearMoneda(item?.precio_unitario || 0)}</td>
				<td>${formatearMoneda(item?.subtotal || 0)}</td>
			</tr>
		`).join("");

		const subtotal = detalle.reduce((sum, item) => sum + Number(item?.subtotal || 0), 0);
		const total = Number(factura?.total || 0);
		const iva = total - subtotal;

		return `
			<html>
				<head>
					<meta charset="utf-8" />
					<style>
						body { font-family: Arial, sans-serif; padding: 18px; color: #111827; }
						h1 { font-size: 22px; margin: 0 0 8px; }
						.meta { font-size: 12px; color: #475569; margin-bottom: 10px; }
						table { width: 100%; border-collapse: collapse; margin-top: 12px; }
						th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
						th { background: #e2e8f0; }
						.totales { margin-top: 14px; text-align: right; font-size: 13px; }
						.total { font-weight: bold; font-size: 16px; margin-top: 6px; }
					</style>
				</head>
				<body>
					<h1>Factura ${factura?.folio || ""}</h1>
					<div class="meta">Venta #${factura?.id_venta || "-"} | Fecha: ${formatearFecha(factura?.fecha)}</div>
					<div class="meta">Cliente: ${factura?.cliente?.nombre || "Público General"} | RFC: ${factura?.datos_fiscales?.rfc || "-"}</div>
					<div class="meta">Método: ${factura?.comprobante?.metodo_pago || "-"} | Forma: ${factura?.comprobante?.forma_pago || "-"}</div>

					<table>
						<thead>
							<tr>
								<th>Producto</th>
								<th>Cantidad</th>
								<th>P. Unitario</th>
								<th>Subtotal</th>
							</tr>
						</thead>
						<tbody>
							${filas}
						</tbody>
					</table>

					<div class="totales">Subtotal: ${formatearMoneda(subtotal)}</div>
					<div class="totales">IVA (16%): ${formatearMoneda(iva)}</div>
					<div class="totales total">Total: ${formatearMoneda(total)}</div>
				</body>
			</html>
		`;
	}, [formatearFecha, formatearMoneda]);

	const compartirFacturaComoPdf = useCallback(async (factura) => {
		const html = construirFacturaHtml(factura);
		const archivo = await Print.printToFileAsync({ html });
		const disponible = await Sharing.isAvailableAsync();

		if (!disponible) {
			Alert.alert("Factura", `PDF generado en: ${archivo.uri}`);
			return;
		}

		await Sharing.shareAsync(archivo.uri, {
			mimeType: "application/pdf",
			dialogTitle: `Factura ${factura?.folio || factura?.id_venta || "venta"}`,
			UTI: ".pdf"
		});
	}, [construirFacturaHtml]);

	const facturarVenta = useCallback((idVenta) => {
		const id = Number(idVenta || 0);
		if (!id) {
			Alert.alert("Ventas", "ID de venta inválido.");
			return;
		}

		setVentaFacturacionId(id);
		setFormFacturacion(crearFormularioFacturacionInicial());
		setModalFacturacionVisible(true);
	}, []);

	const actualizarCampoFacturacion = useCallback((campo, valor) => {
		setFormFacturacion((prev) => ({
			...prev,
			[campo]: valor
		}));
	}, []);

	const guardarFacturacionDesdeModal = useCallback(async () => {
		const id = Number(ventaFacturacionId || 0);
		if (!id) {
			Alert.alert("Facturación", "No se encontró el ID de venta para facturar.");
			return;
		}

		if (!String(formFacturacion.nombre_cliente || "").trim()) {
			Alert.alert("Facturación", "Ingresa el nombre del cliente.");
			return;
		}

		if (!String(formFacturacion.rfc || "").trim()) {
			Alert.alert("Facturación", "Ingresa el RFC.");
			return;
		}

		if (!String(formFacturacion.razon_social || "").trim()) {
			Alert.alert("Facturación", "Ingresa la razón social.");
			return;
		}

		setGuardandoFacturacion(true);

		try {
			const token = await getStoredToken();

			if (!token) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const baseUrl = apiBaseUrl || (await resolverApiBase());
			setApiBaseUrl(baseUrl);

			const payload = {
				nombre_cliente: String(formFacturacion.nombre_cliente || "").trim(),
				correo: String(formFacturacion.correo || "").trim() || null,
				telefono: String(formFacturacion.telefono || "").trim() || null,
				rfc: String(formFacturacion.rfc || "").trim().toUpperCase(),
				razon_social: String(formFacturacion.razon_social || "").trim(),
				uso_cfdi: "G03",
				...FACTURACION_DEFAULTS
			};

			const response = await fetch(`${baseUrl}/api/ventas/${id}/facturar`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(payload)
			});

			if (response.status === 401) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const data = await response.json();

			if (!response.ok) {
				Alert.alert("Facturación", data?.message || "No se pudo facturar esta venta.");
				return;
			}

			setModalFacturacionVisible(false);
			Alert.alert("Facturación", `Factura generada. Folio: ${data?.folio || "N/A"}`);
			await cargarProductos();
		} catch {
			Alert.alert("Facturación", "Error de conexión al facturar la venta.");
		} finally {
			setGuardandoFacturacion(false);
		}
	}, [apiBaseUrl, cargarProductos, formFacturacion, navigation, resolverApiBase, ventaFacturacionId]);

	const descargarFacturaVenta = useCallback(async (idVenta) => {
		const id = Number(idVenta || 0);
		if (!id) {
			Alert.alert("Facturas", "ID de venta inválido.");
			return;
		}

		setProcesandoAccionVenta(true);

		try {
			const token = await getStoredToken();

			if (!token) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const baseUrl = apiBaseUrl || (await resolverApiBase());
			setApiBaseUrl(baseUrl);

			const response = await fetch(`${baseUrl}/api/ventas/${id}/factura`, {
				method: "GET",
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${token}`
				}
			});

			if (response.status === 401) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			const data = await response.json();

			if (!response.ok) {
				Alert.alert("Facturas", data?.message || "No se pudo descargar la factura.");
				return;
			}

			await compartirFacturaComoPdf(data);
		} catch {
			Alert.alert("Facturas", "Error de conexión al descargar factura.");
		} finally {
			setProcesandoAccionVenta(false);
		}
	}, [apiBaseUrl, compartirFacturaComoPdf, navigation, resolverApiBase]);

	const formatearFecha = (fechaIso) => {
		if (!fechaIso || fechaIso === "-") return "-";

		const fecha = new Date(fechaIso);
		if (Number.isNaN(fecha.getTime())) return String(fechaIso);

		return fecha.toLocaleString("es-MX", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit"
		});
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<View style={styles.headerTextWrap}>
						<Text style={styles.headerTitle}>Ventas</Text>
						<Text style={styles.headerSubtitle}>Registra ventas y agrega productos al carrito</Text>
					</View>
					<TouchableOpacity style={styles.refreshIconBtn} onPress={cargarProductos} disabled={cargando}>
						{cargando ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />}
					</TouchableOpacity>
				</View>
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.pageHeaderSimple}>
					<Text style={styles.pageTitleSimple}>Punto de Venta</Text>
					<Text style={styles.pageSubtitleSimple}>Gestiona tus ventas desde el celular</Text>
				</View>

				<View style={styles.panel}>
					<Text style={styles.panelTitle}>Productos</Text>

					<View style={styles.searchBox}>
						<Ionicons name="search-outline" size={18} color="#64748b" />
						<TextInput
							placeholder="Buscar por nombre o código..."
							style={styles.searchInput}
							placeholderTextColor="#94a3b8"
							value={busqueda}
							onChangeText={setBusqueda}
						/>
					</View>

					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
						{categorias.map((categoria) => {
							const activa = categoriaFiltro === categoria;

							return (
								<TouchableOpacity
									key={categoria}
									style={[styles.chip, activa && styles.chipActive]}
									onPress={() => setCategoriaFiltro(categoria)}
								>
									<Text style={[styles.chipText, activa && styles.chipTextActive]}>{categoria}</Text>
								</TouchableOpacity>
							);
						})}
					</ScrollView>

					{cargando ? (
						<View style={styles.estadoBloque}>
							<ActivityIndicator size="small" color="#2563eb" />
							<Text style={styles.estadoTexto}>Cargando inventario...</Text>
						</View>
					) : null}

					{!cargando && errorCarga ? (
						<View style={styles.estadoBloque}>
							<Text style={styles.estadoTexto}>{errorCarga}</Text>
							<TouchableOpacity style={styles.reintentarBtn} onPress={cargarProductos}>
								<Text style={styles.reintentarTexto}>Reintentar</Text>
							</TouchableOpacity>
						</View>
					) : null}

					{!cargando && !errorCarga && !productosFiltrados.length ? (
						<View style={styles.estadoBloque}>
							<Text style={styles.estadoTexto}>No hay productos con ese filtro.</Text>
						</View>
					) : null}

					{!cargando && !errorCarga && productosFiltrados.map((item) => {
						const imagenUrl = resolverImagen(item);
						const cantidad = getCantidadEnCarrito(item.id_producto);

						return (
							<View key={item.id_producto} style={styles.productCard}>
								<View style={styles.productImageWrap}>
									{imagenUrl ? (
										<Image source={{ uri: imagenUrl }} style={styles.productImage} />
									) : (
										<View style={styles.productPlaceholder}>
											<Ionicons name="image-outline" size={18} color="#94a3b8" />
										</View>
									)}
								</View>

								<View style={{ flex: 1 }}>
									<Text style={styles.productName}>{item.nombre}</Text>
									<Text style={styles.productCategory}>{item?.categoria?.nombre || "Sin categoría"}</Text>
									<Text style={styles.productPrice}>${Number(item.precio || 0).toFixed(2)}</Text>
									<Text style={styles.productStock}>Stock: {Number(item.stock || 0)}</Text>
								</View>

								<TouchableOpacity style={styles.addBtn} onPress={() => agregarProducto(item)}>
									<Ionicons name="add" size={14} color="#fff" />
									<Text style={styles.addBtnText}>{cantidad > 0 ? `Agregar (${cantidad})` : "Agregar"}</Text>
								</TouchableOpacity>
							</View>
						);
					})}
				</View>

				<View style={styles.cartPanel}>
					<View style={styles.cartHeader}>
						<Text style={styles.panelTitle}>Carrito de Compra</Text>
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{totalProductosCarrito}</Text>
						</View>
					</View>

					{!carritoItems.length ? (
						<View style={styles.cartEmpty}>
							<Ionicons name="cart-outline" size={28} color="#94a3b8" />
							<Text style={styles.cartEmptyText}>El carrito esta vacio</Text>
						</View>
					) : (
						carritoItems.map((item) => (
							<View key={item.id_producto} style={styles.cartItem}>
								<View style={{ flex: 1 }}>
									<Text style={styles.cartItemName}>{item.nombre}</Text>
									<Text style={styles.cartItemPrice}>${item.precio.toFixed(2)} c/u</Text>
								</View>

								<View style={styles.qtyControls}>
									<TouchableOpacity style={styles.qtyBtn} onPress={() => cambiarCantidad(item.id_producto, -1)}>
										<Text style={styles.qtyBtnText}>-</Text>
									</TouchableOpacity>
									<Text style={styles.qtyValue}>{item.cantidad}</Text>
									<TouchableOpacity style={styles.qtyBtn} onPress={() => cambiarCantidad(item.id_producto, 1)}>
										<Text style={styles.qtyBtnText}>+</Text>
									</TouchableOpacity>
								</View>

								<Text style={styles.cartSubtotal}>${item.subtotal.toFixed(2)}</Text>
							</View>
						))
					)}

					<View style={styles.totalesBox}>
						<View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal:</Text><Text style={styles.totalValue}>${subtotalCarrito.toFixed(2)}</Text></View>
						<View style={styles.totalRow}><Text style={styles.totalLabel}>IVA (16%):</Text><Text style={styles.totalValue}>${ivaCarrito.toFixed(2)}</Text></View>
						<View style={[styles.totalRow, styles.totalFinalRow]}><Text style={styles.totalFinalLabel}>Total:</Text><Text style={styles.totalFinalValue}>${totalCarrito.toFixed(2)}</Text></View>
					</View>

					<Text style={styles.metodoTitulo}>Metodo de Pago</Text>
					<View style={styles.metodoRow}>
						{["Efectivo", "Tarjeta", "Transferencia"].map((metodo) => {
							const activo = metodoPago === metodo;
							return (
								<TouchableOpacity
									key={metodo}
									style={[styles.metodoBtn, activo && styles.metodoBtnActive]}
									onPress={() => setMetodoPago(metodo)}
								>
									<Text style={[styles.metodoBtnText, activo && styles.metodoBtnTextActive]}>{metodo}</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					<TouchableOpacity
						style={[styles.btnConfirmar, ventaLista ? styles.btnConfirmarActivo : styles.btnConfirmarInactivo]}
						onPress={confirmarVenta}
						disabled={!ventaLista}
					>
						<Ionicons name="cash-outline" size={16} color="#fff" />
						<Text style={styles.btnConfirmarText}>{ventaLista ? "Confirmar Venta" : "Agrega productos"}</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.btnCancelar} onPress={limpiarCarrito}>
						<Text style={styles.btnCancelarText}>Cancelar</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.panel}>
					<View style={styles.historialHeader}>
						<Text style={styles.panelTitle}>Historial de Ventas</Text>
						<TouchableOpacity style={styles.recargarHistorialBtn} onPress={cargarProductos}>
							<Ionicons name="refresh-outline" size={16} color="#2c4da7" />
						</TouchableOpacity>
					</View>

					<View style={styles.historialVentasBox}>
						<ScrollView
							nestedScrollEnabled
							showsVerticalScrollIndicator
							contentContainerStyle={styles.historialVentasContent}
						>
							{cargandoHistorial ? (
								<View style={styles.estadoBloque}>
									<ActivityIndicator size="small" color="#2563eb" />
									<Text style={styles.estadoTexto}>Cargando historial...</Text>
								</View>
							) : null}

							{!cargandoHistorial && errorHistorial ? (
								<View style={styles.estadoBloque}>
									<Text style={styles.estadoTexto}>{errorHistorial}</Text>
								</View>
							) : null}

							{!cargandoHistorial && !errorHistorial && !ventasAgrupadas.length ? (
								<View style={styles.estadoBloque}>
									<Text style={styles.estadoTexto}>Aún no hay ventas registradas.</Text>
								</View>
							) : null}

							{!cargandoHistorial && !errorHistorial && ventasAgrupadas.map((venta) => (
								<View key={venta.key} style={styles.ventaCard}>
									<View style={styles.ventaTopRow}>
										<Text style={styles.ventaId}>Venta #{venta.id_venta || "-"}</Text>
										<Text style={styles.ventaTotal}>${Number(venta.total || 0).toFixed(2)}</Text>
									</View>
									<Text style={styles.ventaMeta}>{formatearFecha(venta.fecha)} | {venta.metodo_pago}</Text>
									<Text style={styles.ventaMeta}>Cliente: {venta.cliente}</Text>
									<Text style={styles.ventaMeta}>Articulos: {Number(venta.totalArticulos || 0)}</Text>

									<View style={styles.ventaAccionesRow}>
										<TouchableOpacity style={styles.verDetalleBtn} onPress={() => abrirDetalleVenta(venta.id_venta)}>
											<Text style={styles.verDetalleBtnText}>Ver</Text>
										</TouchableOpacity>

										{venta.esta_facturada ? (
											<TouchableOpacity
												style={[styles.accionVentaBtn, styles.btnDescargarFactura]}
												onPress={() => descargarFacturaVenta(venta.id_venta)}
												disabled={procesandoAccionVenta}
											>
												<Text style={styles.accionVentaBtnText}>Descargar</Text>
											</TouchableOpacity>
										) : (
											<TouchableOpacity
												style={[styles.accionVentaBtn, styles.btnFacturarVenta]}
												onPress={() => facturarVenta(venta.id_venta)}
												disabled={procesandoAccionVenta}
											>
												<Text style={styles.accionVentaBtnText}>Facturar</Text>
											</TouchableOpacity>
										)}
									</View>
								</View>
							))}
						</ScrollView>
					</View>
				</View>
			</ScrollView>

			<Modal
				visible={modalDetalleVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setModalDetalleVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<View style={styles.modalHeaderRow}>
							<Text style={styles.modalTitle}>
								Detalle venta #{detalleVentaActual?.id_venta || "-"}
							</Text>
							<TouchableOpacity onPress={() => setModalDetalleVisible(false)}>
								<Text style={styles.modalCerrar}>Cerrar</Text>
							</TouchableOpacity>
						</View>

						{cargandoDetalleVenta ? (
							<View style={styles.estadoBloque}>
								<ActivityIndicator size="small" color="#2563eb" />
								<Text style={styles.estadoTexto}>Cargando detalle...</Text>
							</View>
						) : null}

						{!cargandoDetalleVenta && errorDetalleVenta ? (
							<View style={styles.estadoBloque}>
								<Text style={styles.estadoTexto}>{errorDetalleVenta}</Text>
							</View>
						) : null}

						{!cargandoDetalleVenta && !errorDetalleVenta && detalleVentaActual ? (
							<ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
								<Text style={styles.modalMeta}>{formatearFecha(detalleVentaActual?.fecha)} | {detalleVentaActual?.metodo_pago || "-"}</Text>
								<Text style={styles.modalMeta}>Cliente: {detalleVentaActual?.cliente || "Público General"}</Text>

								{(Array.isArray(detalleVentaActual?.items) ? detalleVentaActual.items : []).map((item, idx) => (
									<View key={`det-${idx}`} style={styles.modalItemRow}>
										<View style={{ flex: 1 }}>
											<Text style={styles.modalItemNombre}>{item?.producto || "Producto"}</Text>
											<Text style={styles.modalItemMeta}>Cant: {Number(item?.cantidad || 0)}</Text>
										</View>
										<View style={{ alignItems: "flex-end" }}>
											<Text style={styles.modalItemMeta}>P.U.: ${Number(item?.precio_unitario || 0).toFixed(2)}</Text>
											<Text style={styles.modalItemSubtotal}>${Number(item?.subtotal || 0).toFixed(2)}</Text>
										</View>
									</View>
								))}

								<Text style={styles.modalTotal}>Total: ${Number(detalleVentaActual?.total || 0).toFixed(2)}</Text>
							</ScrollView>
						) : null}
					</View>
				</View>
			</Modal>

			<Modal
				visible={modalFacturacionVisible}
				transparent
				animationType="slide"
				onRequestClose={() => setModalFacturacionVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<View style={styles.modalHeaderRow}>
							<Text style={styles.modalTitle}>Facturar venta #{ventaFacturacionId || "-"}</Text>
							<TouchableOpacity onPress={() => setModalFacturacionVisible(false)} disabled={guardandoFacturacion}>
								<Text style={styles.modalCerrar}>Cerrar</Text>
							</TouchableOpacity>
						</View>

						<ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
							<Text style={styles.factLabel}>Nombre cliente</Text>
							<TextInput
								style={styles.factInput}
								value={formFacturacion.nombre_cliente}
								onChangeText={(text) => actualizarCampoFacturacion("nombre_cliente", text)}
								placeholder="Nombre del cliente"
							/>

							<Text style={styles.factLabel}>RFC</Text>
							<TextInput
								style={styles.factInput}
								value={formFacturacion.rfc}
								onChangeText={(text) => actualizarCampoFacturacion("rfc", text)}
								autoCapitalize="characters"
								placeholder="RFC"
							/>

							<Text style={styles.factLabel}>Razón social</Text>
							<TextInput
								style={styles.factInput}
								value={formFacturacion.razon_social}
								onChangeText={(text) => actualizarCampoFacturacion("razon_social", text)}
								placeholder="Razón social"
							/>

							<Text style={styles.factLabel}>Correo (opcional)</Text>
							<TextInput
								style={styles.factInput}
								value={formFacturacion.correo}
								onChangeText={(text) => actualizarCampoFacturacion("correo", text)}
								autoCapitalize="none"
								keyboardType="email-address"
								placeholder="correo@dominio.com"
							/>

							<Text style={styles.factLabel}>Teléfono (opcional)</Text>
							<TextInput
								style={styles.factInput}
								value={formFacturacion.telefono}
								onChangeText={(text) => actualizarCampoFacturacion("telefono", text)}
								keyboardType="phone-pad"
								placeholder="Teléfono"
							/>

							<TouchableOpacity
								style={[styles.btnFacturarGuardar, guardandoFacturacion && styles.btnDisabled]}
								onPress={guardarFacturacionDesdeModal}
								disabled={guardandoFacturacion}
							>
								<Text style={styles.btnFacturarGuardarText}>
									{guardandoFacturacion ? "Generando..." : "Generar factura"}
								</Text>
							</TouchableOpacity>
						</ScrollView>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f1f5f9" },
	header: {
		backgroundColor: "#2c4da7",
		padding: 20,
		borderBottomLeftRadius: 20,
		borderBottomRightRadius: 20
	},
	headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	headerTextWrap: { flex: 1, paddingRight: 12 },
	headerTitle: { color: "white", fontSize: 20, fontWeight: "bold" },
	headerSubtitle: { color: "#dbeafe", marginTop: 4 },
	refreshIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
	scrollContent: { padding: 16, paddingBottom: 28 },
	pageHeaderSimple: {
		marginBottom: 12,
		paddingHorizontal: 4
	},
	pageTitleSimple: { color: "#0f172a", fontSize: 22, fontWeight: "800" },
	pageSubtitleSimple: { color: "#64748b", marginTop: 2 },
	panel: {
		backgroundColor: "#fff",
		borderRadius: 15,
		padding: 15,
		marginBottom: 14,
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 4
	},
	panelTitle: { fontSize: 18, fontWeight: "bold", color: "#0f172a", marginBottom: 10 },
	searchBox: {
		backgroundColor: "#f8fafc",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		flexDirection: "row",
		alignItems: "center"
	},
	searchInput: { flex: 1, marginLeft: 8, color: "#0f172a" },
	chipsRow: { marginTop: 10, marginBottom: 10 },
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 999,
		backgroundColor: "#e2e8f0",
		marginRight: 8
	},
	chipActive: { backgroundColor: "#2c4da7" },
	chipText: { fontSize: 12, fontWeight: "600", color: "#334155" },
	chipTextActive: { color: "#fff" },
	estadoBloque: {
		backgroundColor: "#f8fafc",
		borderRadius: 12,
		padding: 16,
		alignItems: "center",
		marginTop: 8
	},
	estadoTexto: { marginTop: 8, color: "#475569", textAlign: "center" },
	reintentarBtn: {
		marginTop: 10,
		backgroundColor: "#2c4da7",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8
	},
	reintentarTexto: { color: "#fff", fontWeight: "700" },
	productCard: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 10,
		marginTop: 9,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		borderWidth: 1,
		borderColor: "#eef2f7"
	},
	productImageWrap: {
		width: 54,
		height: 54,
		borderRadius: 10,
		overflow: "hidden",
		backgroundColor: "#e2e8f0"
	},
	productImage: { width: "100%", height: "100%" },
	productPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
	productName: { fontWeight: "800", color: "#0f172a" },
	productCategory: { fontSize: 12, color: "#64748b", marginTop: 1 },
	productPrice: { color: "#1d4ed8", fontWeight: "800", marginTop: 4 },
	productStock: { fontSize: 12, color: "#334155", marginTop: 1 },
	addBtn: {
		backgroundColor: "#2c4da7",
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 10,
		flexDirection: "row",
		alignItems: "center"
	},
	addBtnText: { color: "#fff", marginLeft: 4, fontSize: 12, fontWeight: "700" },
	cartPanel: {
		backgroundColor: "#fff",
		borderRadius: 15,
		padding: 14,
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 4
	},
	cartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
	badge: {
		minWidth: 24,
		height: 24,
		borderRadius: 999,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#2c4da7"
	},
	badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
	cartEmpty: { alignItems: "center", paddingVertical: 16 },
	cartEmptyText: { color: "#94a3b8", marginTop: 6 },
	cartItem: {
		backgroundColor: "#f8fafc",
		borderRadius: 12,
		padding: 10,
		marginTop: 8,
		flexDirection: "row",
		alignItems: "center"
	},
	cartItemName: { fontWeight: "700", color: "#0f172a" },
	cartItemPrice: { color: "#64748b", fontSize: 12, marginTop: 2 },
	qtyControls: { flexDirection: "row", alignItems: "center", marginHorizontal: 8 },
	qtyBtn: {
		width: 24,
		height: 24,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "#cbd5e1",
		alignItems: "center",
		justifyContent: "center"
	},
	qtyBtnText: { fontWeight: "700", color: "#334155" },
	qtyValue: { width: 28, textAlign: "center", fontWeight: "700", color: "#0f172a" },
	cartSubtotal: { fontWeight: "800", color: "#1d4ed8" },
	totalesBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 10 },
	totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
	totalLabel: { color: "#64748b" },
	totalValue: { color: "#334155", fontWeight: "700" },
	totalFinalRow: { marginTop: 3 },
	totalFinalLabel: { fontWeight: "800", color: "#0f172a" },
	totalFinalValue: { fontWeight: "900", color: "#16a34a", fontSize: 18 },
	metodoTitulo: { marginTop: 12, marginBottom: 8, fontWeight: "700", color: "#0f172a" },
	metodoRow: { flexDirection: "row", gap: 8 },
	metodoBtn: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#cbd5e1",
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: "center",
		backgroundColor: "#fff"
	},
	metodoBtnActive: { backgroundColor: "#e0e7ff", borderColor: "#2563eb" },
	metodoBtnText: { color: "#334155", fontWeight: "700", fontSize: 12 },
	metodoBtnTextActive: { color: "#1d4ed8" },
	btnConfirmar: {
		marginTop: 12,
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row"
	},
	btnConfirmarInactivo: {
		backgroundColor: "#94a3b8",
		opacity: 0.92
	},
	btnConfirmarActivo: {
		backgroundColor: "#16a34a",
		shadowColor: "#16a34a",
		shadowOpacity: 0.35,
		shadowRadius: 10,
		elevation: 6
	},
	btnConfirmarText: { color: "#fff", fontWeight: "800", marginLeft: 6 },
	btnCancelar: {
		marginTop: 8,
		borderWidth: 1,
		borderColor: "#cbd5e1",
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: "center"
	},
	btnCancelarText: { color: "#475569", fontWeight: "700" }
	,
	historialHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center"
	},
	recargarHistorialBtn: {
		width: 30,
		height: 30,
		borderRadius: 15,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#eef2ff"
	},
	historialVentasBox: {
		marginTop: 8,
		maxHeight: 360,
		borderWidth: 1,
		borderColor: "#e2e8f0",
		borderRadius: 12,
		backgroundColor: "#f8fafc",
		overflow: "hidden"
	},
	historialVentasContent: {
		padding: 8,
		paddingBottom: 12
	},
	ventaCard: {
		backgroundColor: "#f8fafc",
		borderRadius: 12,
		padding: 10,
		marginTop: 8,
		borderWidth: 1,
		borderColor: "#eef2f7"
	},
	ventaTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center"
	},
	ventaId: { fontWeight: "800", color: "#0f172a" },
	ventaTotal: { fontWeight: "900", color: "#16a34a" },
	ventaMeta: { fontSize: 12, color: "#64748b", marginTop: 3 },
	verDetalleBtn: {
		marginTop: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		backgroundColor: "#2c4da7"
	},
	verDetalleBtnText: {
		color: "#fff",
		fontWeight: "800",
		fontSize: 12
	},
	ventaAccionesRow: {
		flexDirection: "row",
		gap: 8,
		marginTop: 10
	},
	accionVentaBtn: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10
	},
	btnFacturarVenta: {
		backgroundColor: "#16a34a"
	},
	btnDescargarFactura: {
		backgroundColor: "#0ea5e9"
	},
	accionVentaBtnText: {
		color: "#fff",
		fontWeight: "800",
		fontSize: 12
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(15, 23, 42, 0.45)",
		padding: 18,
		justifyContent: "center"
	},
	modalCard: {
		maxHeight: "82%",
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 14
	},
	modalHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10
	},
	modalTitle: {
		fontSize: 16,
		fontWeight: "800",
		color: "#0f172a",
		maxWidth: "75%"
	},
	modalCerrar: {
		color: "#2c4da7",
		fontWeight: "800"
	},
	modalBody: {
		maxHeight: 440
	},
	modalMeta: {
		fontSize: 12,
		color: "#64748b",
		marginBottom: 4
	},
	modalItemRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: "#e2e8f0"
	},
	modalItemNombre: {
		fontSize: 13,
		fontWeight: "700",
		color: "#0f172a"
	},
	modalItemMeta: {
		fontSize: 12,
		color: "#64748b",
		marginTop: 2
	},
	modalItemSubtotal: {
		fontSize: 13,
		fontWeight: "800",
		color: "#1d4ed8",
		marginTop: 2
	},
	modalTotal: {
		fontSize: 16,
		fontWeight: "900",
		color: "#16a34a",
		textAlign: "right",
		marginTop: 12
	},
	factLabel: {
		marginTop: 8,
		marginBottom: 4,
		fontSize: 12,
		fontWeight: "700",
		color: "#334155"
	},
	factInput: {
		borderWidth: 1,
		borderColor: "#cbd5e1",
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 9,
		fontSize: 13,
		color: "#0f172a",
		backgroundColor: "#ffffff"
	},
	btnFacturarGuardar: {
		marginTop: 14,
		backgroundColor: "#16a34a",
		borderRadius: 10,
		paddingVertical: 12,
		alignItems: "center"
	},
	btnFacturarGuardarText: {
		color: "#fff",
		fontWeight: "800"
	},
	btnDisabled: {
		opacity: 0.6
	}
});
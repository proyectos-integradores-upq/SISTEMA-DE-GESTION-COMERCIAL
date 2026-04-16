import { SafeAreaView } from "react-native-safe-area-context";
import {
	ScrollView,
	View,
	Text,
	StyleSheet,
	ActivityIndicator,
	TouchableOpacity,
	TextInput,
	Dimensions,
	Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getApiCandidates } from "../config/api";
import { clearSession, getStoredToken } from "../utils/authStorage";

const screenWidth = Dimensions.get("window").width;

const MONTHS = [
	{ value: "", label: "Todos" },
	{ value: "1", label: "Ene" },
	{ value: "2", label: "Feb" },
	{ value: "3", label: "Mar" },
	{ value: "4", label: "Abr" },
	{ value: "5", label: "May" },
	{ value: "6", label: "Jun" },
	{ value: "7", label: "Jul" },
	{ value: "8", label: "Ago" },
	{ value: "9", label: "Sep" },
	{ value: "10", label: "Oct" },
	{ value: "11", label: "Nov" },
	{ value: "12", label: "Dic" },
];

function money(value) {
	return `$${Number(value || 0).toFixed(2)}`;
}

function parseDateValue(value) {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateYmd(value) {
	const date = parseDateValue(value);
	if (!date) return "-";

	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function parseManualDate(value, endOfDay = false) {
	const input = String(value || "").trim();
	if (!input) return null;

	const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;

	const [, y, m, d] = match;
	const date = new Date(`${y}-${m}-${d}T${endOfDay ? "23:59:59" : "00:00:00"}`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export default function ReportesScreen({ navigation }) {
	const [apiBaseUrl, setApiBaseUrl] = useState("");
	const [usuarioNombre, setUsuarioNombre] = useState("Usuario");
	const [cargando, setCargando] = useState(true);
	const [errorCarga, setErrorCarga] = useState("");

	const [productos, setProductos] = useState([]);
	const [ventasRaw, setVentasRaw] = useState([]);
	const [entradasRaw, setEntradasRaw] = useState([]);

	const [filtroDesde, setFiltroDesde] = useState("");
	const [filtroHasta, setFiltroHasta] = useState("");
	const [filtroMes, setFiltroMes] = useState("");
	const [filtroCategoria, setFiltroCategoria] = useState("");

	const resolverApiBase = useCallback(async () => {
		const candidatos = getApiCandidates();

		for (const baseUrl of candidatos) {
			try {
				const response = await fetch(`${baseUrl}/api/test`, { method: "GET" });
				if (response.ok) return baseUrl;
			} catch {
				// Intenta siguiente URL base.
			}
		}

		throw new Error("No se pudo conectar con la API");
	}, []);

	const cargarDatos = useCallback(async () => {
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

			const headers = {
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
			};

			const [meRes, productosRes, ventasRes, entradasRes] = await Promise.all([
				fetch(`${baseUrl}/api/me`, { method: "GET", headers }),
				fetch(`${baseUrl}/api/productos`, { method: "GET", headers }),
				fetch(`${baseUrl}/api/ventas`, { method: "GET", headers }),
				fetch(`${baseUrl}/api/entradas`, { method: "GET", headers }),
			]);

			if ([meRes, productosRes, ventasRes, entradasRes].some((res) => res.status === 401)) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			if (!meRes.ok || !productosRes.ok || !ventasRes.ok || !entradasRes.ok) {
				throw new Error("No se pudo cargar reportes");
			}

			const meData = await meRes.json();
			const productosData = await productosRes.json();
			const ventasData = await ventasRes.json();
			const entradasData = await entradasRes.json();

			setUsuarioNombre(meData?.nombre || "Usuario");
			setProductos(Array.isArray(productosData) ? productosData : []);
			setVentasRaw(Array.isArray(ventasData) ? ventasData : []);
			setEntradasRaw(Array.isArray(entradasData) ? entradasData : []);
		} catch {
			setErrorCarga("No se pudo cargar el módulo de reportes.");
		} finally {
			setCargando(false);
		}
	}, [apiBaseUrl, navigation, resolverApiBase]);

	useEffect(() => {
		void cargarDatos();
	}, [cargarDatos]);

	const categorias = useMemo(() => {
		const map = new Map();

		productos.forEach((item) => {
			const idCategoria = String(item?.categoria?.id_categoria || item?.id_categoria || "");
			if (!idCategoria) return;

			const nombre = String(item?.categoria?.nombre || "Sin categoría");
			map.set(idCategoria, nombre);
		});

		return Array.from(map.entries())
			.sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"))
			.map(([id, nombre]) => ({ id, nombre }));
	}, [productos]);

	const productoById = useMemo(() => {
		const map = new Map();
		productos.forEach((item) => {
			map.set(Number(item?.id_producto || 0), item);
		});
		return map;
	}, [productos]);

	const entradasNormalizadas = useMemo(() => {
		const grouped = new Map();

		entradasRaw.forEach((item) => {
			const idCompra = Number(item?.id_compra || 0);
			if (!idCompra) return;

			if (!grouped.has(idCompra)) {
				grouped.set(idCompra, {
					id_compra: idCompra,
					fecha: item?.fecha || null,
					total: Number(item?.total || 0),
				});
			}
		});

		return Array.from(grouped.values());
	}, [entradasRaw]);

	const ventasFiltradas = useMemo(() => {
		const desdeDate = parseManualDate(filtroDesde, false);
		const hastaDate = parseManualDate(filtroHasta, true);
		const mes = Number(filtroMes || 0);

		return ventasRaw.filter((item) => {
			const fecha = parseDateValue(item?.fecha);
			if (!fecha) return false;

			if (desdeDate && fecha < desdeDate) return false;
			if (hastaDate && fecha > hastaDate) return false;
			if (mes && (fecha.getMonth() + 1) !== mes) return false;

			if (filtroCategoria) {
				const producto = productoById.get(Number(item?.id_producto || 0));
				const idCategoria = String(producto?.id_categoria || producto?.categoria?.id_categoria || "");
				if (idCategoria !== filtroCategoria) return false;
			}

			return true;
		});
	}, [filtroCategoria, filtroDesde, filtroHasta, filtroMes, productoById, ventasRaw]);

	const entradasFiltradas = useMemo(() => {
		const desdeDate = parseManualDate(filtroDesde, false);
		const hastaDate = parseManualDate(filtroHasta, true);
		const mes = Number(filtroMes || 0);

		return entradasNormalizadas.filter((item) => {
			const fecha = parseDateValue(item?.fecha);
			if (!fecha) return false;

			if (desdeDate && fecha < desdeDate) return false;
			if (hastaDate && fecha > hastaDate) return false;
			if (mes && (fecha.getMonth() + 1) !== mes) return false;

			return true;
		});
	}, [entradasNormalizadas, filtroDesde, filtroHasta, filtroMes]);

	const resumen = useMemo(() => {
		const ventasById = new Map();
		const subtotalByVenta = new Map();
		const productosVendidos = new Map();

		ventasFiltradas.forEach((item) => {
			const idVenta = Number(item?.id_venta || 0);
			if (!idVenta) return;

			if (!ventasById.has(idVenta)) {
				ventasById.set(idVenta, {
					id_venta: idVenta,
					fecha: item?.fecha || null,
				});
			}

			const cantidad = Number(item?.cantidad || 0);
			const subtotal = Number(
				item?.subtotal ||
				(Number(item?.cantidad || 0) * Number(item?.precio_unitario || 0)) ||
				0
			);

			subtotalByVenta.set(idVenta, Number(subtotalByVenta.get(idVenta) || 0) + subtotal);

			const nombreProducto = String(item?.producto || "Producto");
			productosVendidos.set(nombreProducto, Number(productosVendidos.get(nombreProducto) || 0) + cantidad);
		});

		let ingresos = 0;
		subtotalByVenta.forEach((subtotal) => {
			ingresos += subtotal * 1.16;
		});

		let productoDestacado = "-";
		let productoDestacadoCantidad = 0;
		Array.from(productosVendidos.entries()).forEach(([nombre, cantidad]) => {
			if (cantidad > productoDestacadoCantidad) {
				productoDestacado = nombre;
				productoDestacadoCantidad = cantidad;
			}
		});

		const stockBajo = productos.filter((item) => Number(item?.stock || 0) < 5).length;

		const ventasPorDia = new Map();
		ventasFiltradas.forEach((item) => {
			const fechaKey = formatDateYmd(item?.fecha);
			const idVenta = Number(item?.id_venta || 0);
			if (fechaKey === "-" || !idVenta) return;

			if (!ventasPorDia.has(fechaKey)) {
				ventasPorDia.set(fechaKey, {
					fecha: fechaKey,
					ventas: new Set(),
					totalDia: 0,
					metodos: new Map(),
				});
			}

			const registro = ventasPorDia.get(fechaKey);
			const subtotal = Number(
				item?.subtotal ||
				(Number(item?.cantidad || 0) * Number(item?.precio_unitario || 0)) ||
				0
			);

			registro.totalDia += subtotal;

			if (!registro.ventas.has(idVenta)) {
				registro.ventas.add(idVenta);
				const metodo = String(item?.metodo_pago || "-");
				registro.metodos.set(metodo, Number(registro.metodos.get(metodo) || 0) + 1);
			}
		});

		const resumenDiario = Array.from(ventasPorDia.values())
			.map((item) => {
				let metodoPredominante = "-";
				let max = 0;

				item.metodos.forEach((count, metodo) => {
					if (count > max) {
						max = count;
						metodoPredominante = metodo;
					}
				});

				return {
					fecha: item.fecha,
					numeroVentas: item.ventas.size,
					totalDia: item.totalDia * 1.16,
					metodoPredominante,
				};
			})
			.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

		const promedioDiario = resumenDiario.length ? ingresos / resumenDiario.length : 0;
		const totalEntradas = entradasFiltradas.reduce((sum, item) => sum + Number(item?.total || 0), 0);
		const gananciaNeta = ingresos - totalEntradas;

		return {
			totalVentas: ventasById.size,
			ingresos,
			productoDestacado,
			productoDestacadoCantidad,
			stockBajo,
			promedioDiario,
			gananciaNeta,
			resumenDiario,
			totalEntradas,
		};
	}, [entradasFiltradas, productos, ventasFiltradas]);

	const chartTopProductos = useMemo(() => {
		const map = new Map();

		ventasFiltradas.forEach((item) => {
			const nombre = String(item?.producto || "Producto");
			map.set(nombre, Number(map.get(nombre) || 0) + Number(item?.cantidad || 0));
		});

		const top = Array.from(map.entries())
			.sort((a, b) => Number(b[1]) - Number(a[1]))
			.slice(0, 6);

		return {
			labels: top.map(([nombre]) => (nombre.length > 9 ? `${nombre.slice(0, 9)}...` : nombre)),
			datasets: [{ data: top.map(([, cantidad]) => Number(cantidad)) }],
		};
	}, [ventasFiltradas]);

	const chartCategorias = useMemo(() => {
		const colors = ["#2c4da7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
		const map = new Map();

		ventasFiltradas.forEach((item) => {
			const producto = productoById.get(Number(item?.id_producto || 0));
			const categoria = String(producto?.categoria?.nombre || "Sin categoría");
			map.set(categoria, Number(map.get(categoria) || 0) + Number(item?.cantidad || 0));
		});

		return Array.from(map.entries())
			.sort((a, b) => Number(b[1]) - Number(a[1]))
			.slice(0, 6)
			.map(([name, population], index) => ({
				name,
				population: Number(population),
				color: colors[index % colors.length],
				legendFontColor: "#334155",
				legendFontSize: 12,
			}));
	}, [productoById, ventasFiltradas]);

	const chartMensual = useMemo(() => {
		const ventasMes = new Map();

		ventasFiltradas.forEach((item) => {
			const fecha = parseDateValue(item?.fecha);
			if (!fecha) return;

			const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
			const subtotal = Number(
				item?.subtotal ||
				(Number(item?.cantidad || 0) * Number(item?.precio_unitario || 0)) ||
				0
			);

			ventasMes.set(mesKey, Number(ventasMes.get(mesKey) || 0) + (subtotal * 1.16));
		});

		const labels = Array.from(ventasMes.keys()).sort().slice(-8);

		return {
			labels: labels.map((label) => label.slice(2)),
			datasets: [{ data: labels.map((label) => Number(ventasMes.get(label) || 0)) }],
		};
	}, [ventasFiltradas]);

	const chartConfig = {
		backgroundGradientFrom: "#ffffff",
		backgroundGradientTo: "#ffffff",
		decimalPlaces: 0,
		color: (opacity = 1) => `rgba(37,99,235,${opacity})`,
		labelColor: (opacity = 1) => `rgba(15,23,42,${opacity})`,
		barPercentage: 0.55,
		propsForBackgroundLines: {
			strokeDasharray: "",
			stroke: "#e2e8f0",
		},
	};

	const limpiarFiltros = useCallback(() => {
		setFiltroDesde("");
		setFiltroHasta("");
		setFiltroMes("");
		setFiltroCategoria("");
	}, []);

	const fechaInvalida = useMemo(() => {
		if (!filtroDesde && !filtroHasta) return false;
		const d1 = filtroDesde ? parseManualDate(filtroDesde) : new Date("2000-01-01");
		const d2 = filtroHasta ? parseManualDate(filtroHasta) : new Date("2999-12-31");
		if (!d1 || !d2) return true;
		return d1 > d2;
	}, [filtroDesde, filtroHasta]);

	const exportarPdf = useCallback(async () => {
		if (!resumen.resumenDiario.length) {
			Alert.alert("Reporte", "No hay datos para exportar con los filtros actuales.");
			return;
		}

		try {
			const fechaEmision = new Date().toLocaleString("es-MX");
			const mesTexto = MONTHS.find((m) => m.value === filtroMes)?.label || "Todos";
			const categoriaTexto = filtroCategoria
				? (categorias.find((c) => c.id === filtroCategoria)?.nombre || "Categoría")
				: "Todas";

			const rowsHtml = resumen.resumenDiario
				.map((item) => `
					<tr>
						<td>${item.fecha}</td>
						<td>${item.numeroVentas}</td>
						<td>${money(item.totalDia)}</td>
						<td>${item.metodoPredominante}</td>
					</tr>
				`)
				.join("");

			const html = `
				<html>
				<head>
					<meta charset="utf-8" />
					<style>
						body { font-family: Arial, sans-serif; color: #0f172a; padding: 20px; }
						h1 { margin: 0 0 8px; color: #1d4ed8; }
						.small { color: #64748b; font-size: 12px; margin-bottom: 16px; }
						.grid { display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px; }
						.card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
						.label { font-size: 12px; color: #64748b; }
						.value { font-size: 16px; font-weight: bold; }
						table { width: 100%; border-collapse: collapse; margin-top: 12px; }
						th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }
						th { background: #f8fafc; }
					</style>
				</head>
				<body>
					<h1>Reporte Ejecutivo - VentaTotal</h1>
					<p class="small">Emitido por: ${usuarioNombre} | Fecha: ${fechaEmision}</p>
					<p class="small">Filtros: Desde ${filtroDesde || "Inicio"} | Hasta ${filtroHasta || "Hoy"} | Mes ${mesTexto} | Categoría ${categoriaTexto}</p>

					<div class="grid">
						<div class="card"><div class="label">Total de ventas</div><div class="value">${resumen.totalVentas}</div></div>
						<div class="card"><div class="label">Ingresos</div><div class="value">${money(resumen.ingresos)}</div></div>
						<div class="card"><div class="label">Ganancia neta</div><div class="value">${money(resumen.gananciaNeta)}</div></div>
						<div class="card"><div class="label">Promedio diario</div><div class="value">${money(resumen.promedioDiario)}</div></div>
						<div class="card"><div class="label">Producto destacado</div><div class="value">${resumen.productoDestacado}</div></div>
						<div class="card"><div class="label">Cantidad vendida</div><div class="value">${resumen.productoDestacadoCantidad}</div></div>
					</div>

					<table>
						<thead>
							<tr>
								<th>Fecha</th>
								<th>No. Ventas</th>
								<th>Total Diario</th>
								<th>Método Predominante</th>
							</tr>
						</thead>
						<tbody>
							${rowsHtml}
						</tbody>
					</table>
				</body>
				</html>
			`;

			const { uri } = await Print.printToFileAsync({ html });
			const canShare = await Sharing.isAvailableAsync();

			if (canShare) {
				await Sharing.shareAsync(uri, {
					UTI: ".pdf",
					mimeType: "application/pdf",
				});
			} else {
				Alert.alert("Reporte generado", `PDF guardado en: ${uri}`);
			}
		} catch {
			Alert.alert("Error", "No se pudo generar el PDF del reporte.");
		}
	}, [categorias, filtroCategoria, filtroDesde, filtroHasta, filtroMes, resumen, usuarioNombre]);

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
				<View style={styles.header}>
					<View style={styles.headerRow}>
						<View style={styles.headerTextWrap}>
							<Text style={styles.headerTitle}>Reportes</Text>
							<Text style={styles.headerSubtitle}>Hola, {usuarioNombre}</Text>
						</View>
						<TouchableOpacity style={styles.refreshIconBtn} onPress={cargarDatos} disabled={cargando}>
							{cargando ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />}
						</TouchableOpacity>
					</View>
				</View>

				{cargando ? (
					<View style={styles.estadoBloque}>
						<ActivityIndicator size="small" color="#2563eb" />
						<Text style={styles.estadoTexto}>Cargando reportes...</Text>
					</View>
				) : null}

				{!cargando && errorCarga ? (
					<View style={styles.estadoBloque}>
						<Text style={styles.estadoTexto}>{errorCarga}</Text>
						<TouchableOpacity style={styles.reintentarBtn} onPress={cargarDatos}>
							<Text style={styles.reintentarTexto}>Reintentar</Text>
						</TouchableOpacity>
					</View>
				) : null}

				{!cargando && !errorCarga ? (
					<>
						<View style={styles.filtroCard}>
							<Text style={styles.cardTitle}>Filtros</Text>

							<View style={styles.filterRow}>
								<View style={styles.filterField}>
									<Text style={styles.filterLabel}>Desde (YYYY-MM-DD)</Text>
									<TextInput
										value={filtroDesde}
										onChangeText={setFiltroDesde}
										placeholder="2026-03-01"
										style={styles.filterInput}
										placeholderTextColor="#94a3b8"
									/>
								</View>

								<View style={styles.filterField}>
									<Text style={styles.filterLabel}>Hasta (YYYY-MM-DD)</Text>
									<TextInput
										value={filtroHasta}
										onChangeText={setFiltroHasta}
										placeholder="2026-03-31"
										style={styles.filterInput}
										placeholderTextColor="#94a3b8"
									/>
								</View>
							</View>

							<Text style={styles.filterLabel}>Mes</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
								{MONTHS.map((item) => {
									const active = filtroMes === item.value;

									return (
										<TouchableOpacity
											key={item.value || "todos"}
											style={[styles.chip, active && styles.chipActive]}
											onPress={() => setFiltroMes(item.value)}
										>
											<Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
										</TouchableOpacity>
									);
								})}
							</ScrollView>

							<Text style={styles.filterLabel}>Categoría</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
								<TouchableOpacity
									style={[styles.chipSec, !filtroCategoria && styles.chipSecActive]}
									onPress={() => setFiltroCategoria("")}
								>
									<Text style={[styles.chipSecText, !filtroCategoria && styles.chipSecTextActive]}>Todas</Text>
								</TouchableOpacity>

								{categorias.map((item) => {
									const active = filtroCategoria === item.id;

									return (
										<TouchableOpacity
											key={item.id}
											style={[styles.chipSec, active && styles.chipSecActive]}
											onPress={() => setFiltroCategoria(item.id)}
										>
											<Text style={[styles.chipSecText, active && styles.chipSecTextActive]}>{item.nombre}</Text>
										</TouchableOpacity>
									);
								})}
							</ScrollView>

							{fechaInvalida ? (
								<Text style={styles.errorFiltro}>Revisa formato de fechas o rango (desde/hasta).</Text>
							) : null}

							<TouchableOpacity style={styles.btnLimpiar} onPress={limpiarFiltros}>
								<Ionicons name="refresh-outline" size={16} color="#1d4ed8" />
								<Text style={styles.btnLimpiarText}>Limpiar filtros</Text>
							</TouchableOpacity>

							<TouchableOpacity style={styles.btnPdf} onPress={exportarPdf}>
								<Ionicons name="download-outline" size={16} color="#ffffff" />
								<Text style={styles.btnPdfText}>Exportar PDF</Text>
							</TouchableOpacity>
						</View>

						<View style={styles.kpiGrid}>
							<View style={styles.kpiCard}>
								<Text style={styles.kpiLabel}>Total de ventas</Text>
								<Text style={styles.kpiValue}>{resumen.totalVentas}</Text>
							</View>

							<View style={styles.kpiCard}>
								<Text style={styles.kpiLabel}>Ingresos</Text>
								<Text style={[styles.kpiValue, styles.kpiMoney]}>{money(resumen.ingresos)}</Text>
							</View>

							<View style={styles.kpiCard}>
								<Text style={styles.kpiLabel}>Ganancia neta</Text>
								<Text style={[styles.kpiValue, styles.kpiMoney]}>{money(resumen.gananciaNeta)}</Text>
							</View>

							<View style={styles.kpiCard}>
								<Text style={styles.kpiLabel}>Promedio diario</Text>
								<Text style={[styles.kpiValue, styles.kpiMoney]}>{money(resumen.promedioDiario)}</Text>
							</View>
						</View>

						<View style={styles.destacadoCard}>
							<Text style={styles.destacadoTitle}>Producto destacado</Text>
							<Text style={styles.destacadoName}>{resumen.productoDestacado}</Text>
							<Text style={styles.destacadoMeta}>{resumen.productoDestacadoCantidad} unidades vendidas</Text>
							<Text style={styles.destacadoMeta}>Stock bajo: {resumen.stockBajo} productos</Text>
							<Text style={styles.destacadoMeta}>Gastos en entradas: {money(resumen.totalEntradas)}</Text>
						</View>

						<View style={styles.chartCard}>
							<Text style={styles.cardTitle}>Productos más vendidos</Text>
							<BarChart
								data={chartTopProductos.labels.length ? chartTopProductos : { labels: ["Sin datos"], datasets: [{ data: [0] }] }}
								width={screenWidth - 44}
								height={220}
								fromZero
								yAxisLabel=""
								chartConfig={chartConfig}
								style={styles.chart}
							/>
						</View>

						<View style={styles.chartCard}>
							<Text style={styles.cardTitle}>Tendencia mensual</Text>
							<LineChart
								data={chartMensual.labels.length ? chartMensual : { labels: ["Sin datos"], datasets: [{ data: [0] }] }}
								width={screenWidth - 44}
								height={220}
								fromZero
								chartConfig={chartConfig}
								style={styles.chart}
							/>
						</View>

						<View style={styles.chartCard}>
							<Text style={styles.cardTitle}>Ventas por categoría</Text>
							{chartCategorias.length ? (
								<PieChart
									data={chartCategorias}
									width={screenWidth - 44}
									height={220}
									chartConfig={chartConfig}
									accessor="population"
									backgroundColor="transparent"
									paddingLeft="6"
								/>
							) : (
								<Text style={styles.sinDatos}>Sin datos para graficar.</Text>
							)}
						</View>

						<View style={styles.chartCard}>
							<Text style={styles.cardTitle}>Detalle diario</Text>

							{!resumen.resumenDiario.length ? (
								<Text style={styles.sinDatos}>No hay ventas para el filtro seleccionado.</Text>
							) : (
								resumen.resumenDiario.slice(0, 14).map((item) => (
									<View key={`${item.fecha}-${item.numeroVentas}-${item.totalDia}`} style={styles.rowItem}>
										<View>
											<Text style={styles.rowTitle}>{item.fecha}</Text>
											<Text style={styles.rowMeta}>{item.metodoPredominante}</Text>
										</View>

										<View style={styles.rowRight}>
											<Text style={styles.rowCount}>{item.numeroVentas} ventas</Text>
											<Text style={styles.rowMoney}>{money(item.totalDia)}</Text>
										</View>
									</View>
								))
							)}
						</View>
					</>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f1f5f9",
	},
	scrollContent: {
		paddingBottom: 24,
	},
	header: {
		backgroundColor: "#2c4da7",
		paddingHorizontal: 20,
		paddingVertical: 18,
		borderBottomLeftRadius: 18,
		borderBottomRightRadius: 18,
	},
	headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	headerTextWrap: { flex: 1, paddingRight: 12 },
	headerTitle: {
		color: "#fff",
		fontSize: 22,
		fontWeight: "700",
	},
	headerSubtitle: {
		color: "#dbeafe",
		marginTop: 4,
	},
	refreshIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
	estadoBloque: {
		marginHorizontal: 16,
		marginTop: 16,
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 16,
		alignItems: "center",
		gap: 8,
	},
	estadoTexto: {
		color: "#475569",
	},
	reintentarBtn: {
		backgroundColor: "#1d4ed8",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	reintentarTexto: {
		color: "#fff",
		fontWeight: "600",
	},
	filtroCard: {
		marginHorizontal: 16,
		marginTop: 16,
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 14,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: "#0f172a",
		marginBottom: 10,
	},
	filterRow: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 8,
	},
	filterField: {
		flex: 1,
	},
	filterLabel: {
		fontSize: 12,
		color: "#475569",
		marginBottom: 6,
		fontWeight: "600",
	},
	filterInput: {
		borderWidth: 1,
		borderColor: "#cbd5e1",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: "#0f172a",
		marginBottom: 10,
	},
	chipsRow: {
		marginBottom: 10,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: "#eef2ff",
		marginRight: 8,
	},
	chipActive: {
		backgroundColor: "#1d4ed8",
	},
	chipText: {
		color: "#1e3a8a",
		fontWeight: "600",
		fontSize: 12,
	},
	chipTextActive: {
		color: "#fff",
	},
	chipSec: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: "#f1f5f9",
		marginRight: 8,
	},
	chipSecActive: {
		backgroundColor: "#0f766e",
	},
	chipSecText: {
		color: "#0f172a",
		fontWeight: "600",
		fontSize: 12,
	},
	chipSecTextActive: {
		color: "#fff",
	},
	errorFiltro: {
		color: "#b91c1c",
		fontSize: 12,
		marginBottom: 8,
	},
	btnLimpiar: {
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#dbeafe",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
	},
	btnLimpiarText: {
		color: "#1d4ed8",
		fontWeight: "700",
		fontSize: 12,
	},
	btnPdf: {
		marginTop: 10,
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#16a34a",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
	},
	btnPdfText: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 12,
	},
	kpiGrid: {
		marginHorizontal: 16,
		marginTop: 14,
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: 10,
	},
	kpiCard: {
		width: "48.5%",
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 12,
	},
	kpiLabel: {
		fontSize: 12,
		color: "#64748b",
		marginBottom: 6,
	},
	kpiValue: {
		fontSize: 20,
		fontWeight: "700",
		color: "#0f172a",
	},
	kpiMoney: {
		fontSize: 17,
		color: "#15803d",
	},
	destacadoCard: {
		marginHorizontal: 16,
		marginTop: 12,
		backgroundColor: "#0f172a",
		borderRadius: 14,
		padding: 14,
	},
	destacadoTitle: {
		color: "#93c5fd",
		fontSize: 13,
	},
	destacadoName: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
		marginVertical: 4,
	},
	destacadoMeta: {
		color: "#cbd5e1",
		fontSize: 12,
		marginTop: 2,
	},
	chartCard: {
		backgroundColor: "#fff",
		marginHorizontal: 16,
		marginTop: 14,
		borderRadius: 14,
		padding: 12,
	},
	chart: {
		borderRadius: 12,
	},
	sinDatos: {
		color: "#64748b",
		paddingVertical: 10,
	},
	rowItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#f1f5f9",
	},
	rowTitle: {
		color: "#0f172a",
		fontWeight: "700",
	},
	rowMeta: {
		color: "#64748b",
		fontSize: 12,
		marginTop: 2,
	},
	rowRight: {
		alignItems: "flex-end",
	},
	rowCount: {
		color: "#1d4ed8",
		fontSize: 12,
		fontWeight: "700",
	},
	rowMoney: {
		color: "#15803d",
		fontWeight: "700",
		marginTop: 2,
	},
});
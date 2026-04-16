import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, PieChart } from "react-native-chart-kit";
import { getApiCandidates } from "../config/api";
import { clearSession, getStoredToken } from "../utils/authStorage";

const screenWidth = Dimensions.get("window").width;

export default function HomeScreen({ navigation }) {
	const [apiBaseUrl, setApiBaseUrl] = useState("");
	const [usuarioNombre, setUsuarioNombre] = useState("Usuario");
	const [productos, setProductos] = useState([]);
	const [ventas, setVentas] = useState([]);
	const [cargando, setCargando] = useState(true);
	const [errorCarga, setErrorCarga] = useState("");
	const [busqueda, setBusqueda] = useState("");
	const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");

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

	const cargarDashboard = useCallback(async () => {
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
				Authorization: `Bearer ${token}`
			};

			const [meRes, productosRes, ventasRes] = await Promise.all([
				fetch(`${baseUrl}/api/me`, { method: "GET", headers }),
				fetch(`${baseUrl}/api/productos`, { method: "GET", headers }),
				fetch(`${baseUrl}/api/ventas`, { method: "GET", headers })
			]);

			if (meRes.status === 401 || productosRes.status === 401 || ventasRes.status === 401) {
				await clearSession();
				navigation.replace("Login");
				return;
			}

			if (!meRes.ok || !productosRes.ok || !ventasRes.ok) {
				throw new Error("No se pudo cargar el dashboard");
			}

			const meData = await meRes.json();
			const productosData = await productosRes.json();
			const ventasData = await ventasRes.json();

			setUsuarioNombre(meData?.nombre || "Usuario");
			setProductos(Array.isArray(productosData) ? productosData : []);
			setVentas(Array.isArray(ventasData) ? ventasData : []);
		} catch {
			setErrorCarga("No se pudo cargar el dashboard. Intenta nuevamente.");
		} finally {
			setCargando(false);
		}
	}, [apiBaseUrl, navigation, resolverApiBase]);

	useEffect(() => {
		void cargarDashboard();
	}, [cargarDashboard]);

	const categorias = useMemo(() => {
		const values = new Set();
		productos.forEach((item) => {
			values.add(String(item?.categoria?.nombre || "Sin categoría"));
		});

		return ["TODAS", ...Array.from(values).sort((a, b) => a.localeCompare(b, "es"))];
	}, [productos]);

	const productosFiltrados = useMemo(() => {
		const texto = busqueda.trim().toLowerCase();

		return productos.filter((item) => {
			const nombre = String(item?.nombre || "").toLowerCase();
			const codigo = String(item?.codigo || "").toLowerCase();
			const categoria = String(item?.categoria?.nombre || "Sin categoría");

			const coincideTexto = !texto || nombre.includes(texto) || codigo.includes(texto);
			const coincideCategoria = categoriaFiltro === "TODAS" || categoria === categoriaFiltro;

			return coincideTexto && coincideCategoria;
		});
	}, [busqueda, categoriaFiltro, productos]);

	const resumenHoy = useMemo(() => {
		const hoy = new Date();
		const anio = hoy.getFullYear();
		const mes = String(hoy.getMonth() + 1).padStart(2, "0");
		const dia = String(hoy.getDate()).padStart(2, "0");
		const claveHoy = `${anio}-${mes}-${dia}`;

		const ventasHoyMap = new Map();
		ventas.forEach((item) => {
			const idVenta = Number(item?.id_venta || 0);
			if (!idVenta) return;

			const fecha = String(item?.fecha || "").slice(0, 10);
			if (fecha !== claveHoy) return;

			if (!ventasHoyMap.has(idVenta)) {
				ventasHoyMap.set(idVenta, Number(item?.total || 0));
			}
		});

		const ingresosHoy = Array.from(ventasHoyMap.values()).reduce((sum, total) => sum + Number(total || 0), 0);

		return {
			ventasHoy: ventasHoyMap.size,
			ingresosHoy,
		};
	}, [ventas]);

	const totalStockBajo = useMemo(() => {
		return productos.filter((item) => Number(item?.stock || 0) < 5).length;
	}, [productos]);

	const chartTopProductos = useMemo(() => {
		const agrupado = new Map();

		ventas.forEach((item) => {
			const nombre = String(item?.producto || "Producto");
			const cantidad = Number(item?.cantidad || 0);
			agrupado.set(nombre, Number(agrupado.get(nombre) || 0) + cantidad);
		});

		const top = Array.from(agrupado.entries())
			.sort((a, b) => Number(b[1]) - Number(a[1]))
			.slice(0, 5);

		return {
			labels: top.map(([nombre]) => nombre.length > 8 ? `${nombre.slice(0, 8)}...` : nombre),
			datasets: [{ data: top.map(([, cantidad]) => Number(cantidad)) }],
		};
	}, [ventas]);

	const chartInventarioCategoria = useMemo(() => {
		const colores = ["#2c4da7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
		const agrupado = new Map();

		productos.forEach((item) => {
			const categoria = String(item?.categoria?.nombre || "Sin categoría");
			const stock = Number(item?.stock || 0);
			agrupado.set(categoria, Number(agrupado.get(categoria) || 0) + stock);
		});

		return Array.from(agrupado.entries())
			.slice(0, 6)
			.map(([categoria, stock], index) => ({
				name: categoria,
				population: Number(stock),
				color: colores[index % colores.length],
				legendFontColor: "#374151",
				legendFontSize: 12,
			}));
	}, [productos]);

	const chartConfig = {
		backgroundGradientFrom: "#ffffff",
		backgroundGradientTo: "#ffffff",
		decimalPlaces: 0,
		color: (opacity = 1) => `rgba(44,77,167,${opacity})`,
		labelColor: (opacity = 1) => `rgba(15,23,42,${opacity})`,
		barPercentage: 0.55,
		propsForBackgroundLines: {
			strokeDasharray: "",
			stroke: "#e2e8f0"
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
				<View style={styles.header}>
					<View style={styles.headerRow}>
						<View style={styles.headerTextWrap}>
							<Text style={styles.headerTitle}>Dashboard</Text>
							<Text style={styles.headerSubtitle}>Hola, {usuarioNombre}</Text>
						</View>
						<TouchableOpacity style={styles.refreshIconBtn} onPress={cargarDashboard} disabled={cargando}>
							{cargando ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />}
						</TouchableOpacity>
					</View>
				</View>

				{cargando ? (
					<View style={styles.estadoBloque}>
						<ActivityIndicator size="small" color="#2563eb" />
						<Text style={styles.estadoTexto}>Cargando dashboard...</Text>
					</View>
				) : null}

				{!cargando && errorCarga ? (
					<View style={styles.estadoBloque}>
						<Text style={styles.estadoTexto}>{errorCarga}</Text>
						<TouchableOpacity style={styles.reintentarBtn} onPress={cargarDashboard}>
							<Text style={styles.reintentarTexto}>Reintentar</Text>
						</TouchableOpacity>
					</View>
				) : null}

				{!cargando && !errorCarga ? (
					<>
						<View style={styles.cardsGrid}>
							<TouchableOpacity style={[styles.card, styles.cardProductos]} onPress={() => navigation.navigate("Productos")}>
								<View style={styles.cardTopRow}>
									<Text style={styles.cardLabel}>Total Productos</Text>
									<View style={[styles.cardIconWrap, { backgroundColor: "#dbeafe" }]}>
										<Ionicons name="cube-outline" size={16} color="#1d4ed8" />
									</View>
								</View>
								<Text style={styles.cardValue}>{productos.length}</Text>
								<Text style={styles.cardHint}>Abrir Productos</Text>
							</TouchableOpacity>

							<TouchableOpacity style={[styles.card, styles.cardStock]} onPress={() => navigation.navigate("Productos")}>
								<View style={styles.cardTopRow}>
									<Text style={styles.cardLabel}>Stock Bajo</Text>
									<View style={[styles.cardIconWrap, { backgroundColor: "#fee2e2" }]}>
										<Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
									</View>
								</View>
								<Text style={[styles.cardValue, { color: "#dc2626" }]}>{totalStockBajo}</Text>
								<Text style={styles.cardHint}>Revisar inventario</Text>
							</TouchableOpacity>

							<TouchableOpacity style={[styles.card, styles.cardVentas]} onPress={() => navigation.navigate("Ventas")}>
								<View style={styles.cardTopRow}>
									<Text style={styles.cardLabel}>Total Ventas</Text>
									<View style={[styles.cardIconWrap, { backgroundColor: "#dcfce7" }]}>
										<Ionicons name="cart-outline" size={16} color="#15803d" />
									</View>
								</View>
								<Text style={[styles.cardValue, { color: "#16a34a" }]}>{resumenHoy.ventasHoy}</Text>
								<Text style={styles.cardHint}>Abrir Ventas</Text>
							</TouchableOpacity>

							<TouchableOpacity style={[styles.card, styles.cardIngresos]} onPress={() => navigation.navigate("Ventas")}>
								<View style={styles.cardTopRow}>
									<Text style={styles.cardLabel}>Ingresos del Dia</Text>
									<View style={[styles.cardIconWrap, { backgroundColor: "#e0e7ff" }]}>
										<Ionicons name="cash-outline" size={16} color="#4338ca" />
									</View>
								</View>
								<Text style={[styles.cardValue, { color: "#2563eb" }]}>${Number(resumenHoy.ingresosHoy || 0).toFixed(2)}</Text>
								<Text style={styles.cardHint}>Ir a módulo ventas</Text>
							</TouchableOpacity>
						</View>

						<View style={styles.chartCard}>
							<Text style={styles.chartTitle}>Productos más vendidos</Text>
							<BarChart
								data={chartTopProductos.labels.length ? chartTopProductos : { labels: ["Sin datos"], datasets: [{ data: [0] }] }}
								width={screenWidth - 48}
								height={220}
								fromZero
								yAxisLabel=""
								chartConfig={chartConfig}
								style={styles.chart}
							/>
						</View>

						<View style={styles.chartCard}>
							<Text style={styles.chartTitle}>Inventario por categoría</Text>
							{chartInventarioCategoria.length ? (
								<PieChart
									data={chartInventarioCategoria}
									width={screenWidth - 48}
									height={220}
									chartConfig={chartConfig}
									accessor="population"
									backgroundColor="transparent"
									paddingLeft="8"
								/>
							) : (
								<Text style={styles.sinDatos}>Sin datos de inventario para graficar.</Text>
							)}
						</View>

						<View style={styles.panel}>
							<View style={styles.panelHeader}>
								<Text style={styles.panelTitle}>Productos</Text>
								<TouchableOpacity onPress={() => navigation.navigate("Productos")}>
									<Text style={styles.irTexto}>Ver todos</Text>
								</TouchableOpacity>
							</View>

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

							{!productosFiltrados.length ? (
								<Text style={styles.sinDatos}>No hay productos con ese filtro.</Text>
							) : (
								productosFiltrados.slice(0, 12).map((item) => (
									<View key={item.id_producto} style={styles.productRow}>
										<View style={{ flex: 1 }}>
											<Text style={styles.productName}>{item.nombre}</Text>
											<Text style={styles.productMeta}>{item.codigo} | {item?.categoria?.nombre || "Sin categoría"}</Text>
										</View>
										<View style={{ alignItems: "flex-end" }}>
											<Text style={styles.productPrice}>${Number(item?.precio || 0).toFixed(2)}</Text>
											<Text style={[styles.productStock, Number(item?.stock || 0) < 5 && styles.productStockBajo]}>Stock: {Number(item?.stock || 0)}</Text>
											<TouchableOpacity style={styles.btnVerProducto} onPress={() => navigation.navigate("Productos")}>
												<Text style={styles.btnVerProductoText}>Ver</Text>
											</TouchableOpacity>
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
	container: { flex: 1, backgroundColor: "#f1f5f9" },
	scrollContent: { paddingBottom: 24 },
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
	refreshIconBtn: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: "#eff6ff",
		alignItems: "center",
		justifyContent: "center"
	},
	estadoBloque: {
		backgroundColor: "#fff",
		margin: 16,
		borderRadius: 12,
		padding: 16,
		alignItems: "center"
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
	cardsGrid: {
		marginTop: 14,
		marginHorizontal: 16,
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: 10
	},
	card: {
		backgroundColor: "#fff",
		width: "48.5%",
		borderRadius: 14,
		padding: 14,
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 3
	},
	cardProductos: { borderWidth: 1, borderColor: "#dbeafe" },
	cardStock: { borderWidth: 1, borderColor: "#fee2e2" },
	cardVentas: { borderWidth: 1, borderColor: "#dcfce7" },
	cardIngresos: { borderWidth: 1, borderColor: "#e0e7ff" },
	cardTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center"
	},
	cardIconWrap: {
		width: 28,
		height: 28,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center"
	},
	cardLabel: { color: "#64748b", fontSize: 12 },
	cardValue: { marginTop: 8, color: "#0f172a", fontSize: 20, fontWeight: "900" },
	cardHint: { marginTop: 4, fontSize: 11, color: "#64748b", fontWeight: "600" },
	chartCard: {
		backgroundColor: "#fff",
		marginHorizontal: 16,
		marginTop: 14,
		borderRadius: 14,
		padding: 12,
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 3
	},
	chartTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
	chart: { borderRadius: 10 },
	panel: {
		backgroundColor: "#fff",
		marginHorizontal: 16,
		marginTop: 14,
		borderRadius: 14,
		padding: 12,
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 3
	},
	panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	panelTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
	irTexto: { color: "#2c4da7", fontWeight: "700", fontSize: 12 },
	searchBox: {
		marginTop: 10,
		backgroundColor: "#f8fafc",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		flexDirection: "row",
		alignItems: "center"
	},
	searchInput: { flex: 1, marginLeft: 8, color: "#0f172a" },
	chipsRow: { marginTop: 10 },
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
	chipSec: {
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 999,
		backgroundColor: "#f1f5f9",
		marginRight: 8,
		borderWidth: 1,
		borderColor: "#cbd5e1"
	},
	chipSecActive: { backgroundColor: "#dbeafe", borderColor: "#60a5fa" },
	chipSecText: { fontSize: 12, fontWeight: "600", color: "#334155" },
	chipSecTextActive: { color: "#1d4ed8" },
	productRow: {
		marginTop: 10,
		backgroundColor: "#f8fafc",
		borderRadius: 10,
		padding: 10,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between"
	},
	productName: { fontWeight: "700", color: "#0f172a" },
	productMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
	productPrice: { fontWeight: "800", color: "#1d4ed8" },
	productStock: { fontSize: 12, color: "#334155", marginTop: 2 },
	productStockBajo: { color: "#dc2626", fontWeight: "700" },
	btnVerProducto: {
		marginTop: 8,
		backgroundColor: "#dbeafe",
		paddingHorizontal: 12,
		paddingVertical: 5,
		borderRadius: 8
	},
	btnVerProductoText: {
		color: "#1d4ed8",
		fontSize: 12,
		fontWeight: "700"
	},
	sinDatos: { color: "#64748b", marginTop: 8 }
});
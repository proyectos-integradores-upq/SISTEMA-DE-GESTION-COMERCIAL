import { SafeAreaView } from "react-native-safe-area-context";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiCandidates } from "../config/api";
import { clearSession, getStoredToken } from "../utils/authStorage";

export default function EntradasScreen({ navigation }) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [guardandoEntrada, setGuardandoEntrada] = useState(false);
  const [error, setError] = useState("");
  const [mensajeEntrada, setMensajeEntrada] = useState("");

  const [proveedores, setProveedores] = useState([]);
  const [productosPorProveedor, setProductosPorProveedor] = useState({});
  const [historialEntradas, setHistorialEntradas] = useState([]);
  const [detalleVisible, setDetalleVisible] = useState(false);
  const [compraDetalle, setCompraDetalle] = useState(null);

  const [proveedorEntradaId, setProveedorEntradaId] = useState("");
  const [productosEntradaSeleccion, setProductosEntradaSeleccion] = useState({});
  const [observacionEntrada, setObservacionEntrada] = useState("");

  const resolverApiBase = useCallback(async () => {
    const candidatos = getApiCandidates();

    for (const baseUrl of candidatos) {
      try {
        const response = await fetch(`${baseUrl}/api/test`, { method: "GET" });
        if (response.ok) return baseUrl;
      } catch {
        // try next
      }
    }

    throw new Error("No se pudo conectar con la API");
  }, []);

  const getHeaders = useCallback(async (json = false) => {
    const token = await getStoredToken();

    if (!token) {
      await clearSession();
      navigation.replace("Login");
      return null;
    }

    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    };
  }, [navigation]);

  const obtenerMensajeError = (payload, fallback) => {
    if (!payload || typeof payload !== "object") return fallback;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;

    if (payload.errors && typeof payload.errors === "object") {
      const primerCampo = Object.keys(payload.errors)[0];
      const primerError = primerCampo ? payload.errors[primerCampo]?.[0] : null;
      if (typeof primerError === "string" && primerError.trim()) return primerError;
    }

    return fallback;
  };

  const cargarHistorial = useCallback(async (baseUrl, headers) => {
    const resHistorial = await fetch(`${baseUrl}/api/entradas`, { method: "GET", headers });
    if (!resHistorial.ok) {
      setHistorialEntradas([]);
      return;
    }

    const data = await resHistorial.json();
    setHistorialEntradas(Array.isArray(data) ? data : []);
  }, []);

  const cargarDatos = useCallback(async () => {
    setError("");

    try {
      const headers = await getHeaders(false);
      if (!headers) return;

      const baseUrl = apiBaseUrl || (await resolverApiBase());
      setApiBaseUrl(baseUrl);

      const resProv = await fetch(`${baseUrl}/api/proveedores`, { method: "GET", headers });

      if (!resProv.ok) throw new Error("Error al cargar datos");

      const provData = await resProv.json();

      const provArray = Array.isArray(provData) ? provData : [];

      setProveedores(provArray);

      const map = {};
      await Promise.all(
        provArray.map(async (prov) => {
          try {
            const r = await fetch(`${baseUrl}/api/proveedores/${prov.id_proveedor}/productos`, { method: "GET", headers });
            map[String(prov.id_proveedor)] = r.ok ? (await r.json()) : [];
          } catch {
            map[String(prov.id_proveedor)] = [];
          }
        })
      );

      setProductosPorProveedor(map);
      await cargarHistorial(baseUrl, headers);
    } catch {
      setError("No se pudo cargar el módulo de entradas.");
    }
  }, [apiBaseUrl, cargarHistorial, getHeaders, resolverApiBase]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const proveedoresActivos = useMemo(
    () => proveedores.filter((item) => String(item?.estado || "").toLowerCase() === "activo").length,
    [proveedores]
  );

  const proveedoresActivosLista = useMemo(
    () => proveedores.filter((item) => String(item?.estado || "").toLowerCase() === "activo"),
    [proveedores]
  );

  useEffect(() => {
    if (!proveedorEntradaId) return;

    const sigueActivo = proveedoresActivosLista.some((item) => String(item.id_proveedor) === String(proveedorEntradaId));
    if (!sigueActivo) {
      setProveedorEntradaId("");
      setProductosEntradaSeleccion({});
    }
  }, [proveedorEntradaId, proveedoresActivosLista]);

  const productosEntradaDisponibles = useMemo(() => {
    if (!proveedorEntradaId) return [];

    const lista = productosPorProveedor[String(proveedorEntradaId)] || [];
    return lista.filter((item) => Number(item?.id_producto || 0) > 0);
  }, [proveedorEntradaId, productosPorProveedor]);

  const productosEntradaSeleccionados = useMemo(() => {
    const ids = Object.entries(productosEntradaSeleccion)
      .filter(([, value]) => Boolean(value?.checked))
      .map(([id]) => Number(id));

    return ids
      .map((idProducto) => {
        const item = productosEntradaDisponibles.find((p) => Number(p.id_producto) === idProducto);
        const estado = productosEntradaSeleccion[String(idProducto)] || { checked: false, cantidad: "" };
        if (!item) return null;

        const cantidad = Number(estado.cantidad || 0);
        return {
          id_producto: idProducto,
          nombre: item.nombre,
          precio_compra: Number(item.precio_compra || 0),
          cantidad,
        };
      })
      .filter(Boolean);
  }, [productosEntradaDisponibles, productosEntradaSeleccion]);

  const totalEntrada = useMemo(() => {
    const total = productosEntradaSeleccionados.reduce((sum, item) => {
      const cantidad = Number(item.cantidad || 0);
      const precio = Number(item.precio_compra || 0);

      if (!Number.isFinite(cantidad) || cantidad <= 0) return sum;
      if (!Number.isFinite(precio) || precio <= 0) return sum;

      return sum + (cantidad * precio);
    }, 0);

    return Math.round(total * 100) / 100;
  }, [productosEntradaSeleccionados]);

  const historialCompras = useMemo(() => {
    const grupos = new Map();

    historialEntradas.forEach((item, index) => {
      const idCompra = Number(item?.id_compra || item?.compra_id || 0);
      const key = idCompra > 0 ? `c-${idCompra}` : `d-${item?.id_detalle || index}`;

      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          id_compra: idCompra || null,
          fecha: item?.fecha,
          proveedor: item?.proveedor || item?.proveedor_nombre || "-",
          observacion: item?.observacion || "-",
          usuario: item?.usuario || "Admin",
          items: [],
          cantidadTotal: 0,
          total: 0,
        });
      }

      const grupo = grupos.get(key);
      const cantidad = Number(item?.cantidad || 0);
      const precio = Number(item?.precio_compra || item?.precio_unitario || 0);
      const subtotalApi = Number(item?.subtotal ?? item?.total ?? 0);
      const subtotal = Number.isFinite(cantidad) && Number.isFinite(precio) && cantidad > 0
        ? (cantidad * precio)
        : (Number.isFinite(subtotalApi) ? subtotalApi : 0);

      grupo.items.push({
        producto: item?.producto || "-",
        cantidad: Number.isFinite(cantidad) ? cantidad : 0,
        precio_compra: Number.isFinite(precio) ? precio : 0,
        subtotal,
      });
      grupo.cantidadTotal += Number.isFinite(cantidad) ? cantidad : 0;
      grupo.total += subtotal;
    });

    return Array.from(grupos.values());
  }, [historialEntradas]);

  const abrirDetalleCompra = (compra) => {
    setCompraDetalle(compra);
    setDetalleVisible(true);
  };

  const cerrarDetalleCompra = () => {
    setDetalleVisible(false);
    setCompraDetalle(null);
  };

  useEffect(() => {
    if (!proveedorEntradaId) {
      setProductosEntradaSeleccion({});
      return;
    }

    const validos = new Set(productosEntradaDisponibles.map((item) => Number(item.id_producto)));
    setProductosEntradaSeleccion((prev) => {
      const next = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (validos.has(Number(id)) && value?.checked) {
          next[id] = {
            checked: true,
            cantidad: String(value?.cantidad ?? ""),
          };
        }
      });
      return next;
    });
  }, [productosEntradaDisponibles, proveedorEntradaId]);

  const toggleProductoEntrada = (idProducto) => {
    setProductosEntradaSeleccion((prev) => {
      const key = String(idProducto);
      const actual = prev[key] || { checked: false, cantidad: "" };

      if (actual.checked) {
        const next = { ...prev };
        delete next[key];
        return next;
      }

      return {
        ...prev,
        [key]: {
          checked: true,
          cantidad: String(actual.cantidad ?? ""),
        },
      };
    });
  };

  const actualizarCantidadProductoEntrada = (idProducto, cantidadTexto) => {
    const key = String(idProducto);
    setProductosEntradaSeleccion((prev) => ({
      ...prev,
      [key]: {
        checked: true,
        cantidad: cantidadTexto,
      },
    }));
  };

  const registrarEntrada = async () => {
    const idProveedor = Number(proveedorEntradaId || 0);

    if (!idProveedor) {
      setMensajeEntrada("Selecciona un proveedor.");
      return;
    }

    if (!productosEntradaSeleccionados.length) {
      setMensajeEntrada("Selecciona uno o más productos del proveedor.");
      return;
    }

    const cantidadInvalida = productosEntradaSeleccionados.some((item) => {
      const cantidad = Number(item.cantidad || 0);
      return !Number.isFinite(cantidad) || cantidad <= 0;
    });

    if (cantidadInvalida) {
      setMensajeEntrada("Cada producto seleccionado debe tener cantidad valida mayor a 0.");
      return;
    }

    try {
      setGuardandoEntrada(true);
      setMensajeEntrada("");

      const headers = await getHeaders(true);
      if (!headers) return;

      const baseUrl = apiBaseUrl || (await resolverApiBase());
      setApiBaseUrl(baseUrl);

      const response = await fetch(`${baseUrl}/api/entradas`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id_proveedor: idProveedor,
          items: productosEntradaSeleccionados.map((item) => ({
            id_producto: item.id_producto,
            cantidad: Number(item.cantidad),
          })),
          observacion: observacionEntrada.trim() || null
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        setMensajeEntrada(obtenerMensajeError(payload, "No se pudo registrar la entrada."));
        return;
      }

      setObservacionEntrada("");
      setProductosEntradaSeleccion({});

      if (Array.isArray(payload.items) && payload.items.length) {
        const nuevasFilas = payload.items.map((item) => ({
          ...payload,
          id_producto: item.id_producto,
          producto: item.producto,
          cantidad: item.cantidad,
          precio_compra: item.precio_compra,
          total: item.subtotal,
        }));

        setHistorialEntradas((prev) => [...nuevasFilas, ...prev].slice(0, 100));
      } else {
        setHistorialEntradas((prev) => [payload, ...prev].slice(0, 100));
      }

      Alert.alert("Entradas", "Entrada registrada correctamente.");
    } catch {
      setMensajeEntrada("Error de conexión al registrar entrada.");
    } finally {
      setGuardandoEntrada(false);
    }
  };

  const formatearFecha = (valor) => {
    if (!valor) return "-";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Entradas de Inventario</Text>
              <Text style={styles.headerSubtitle}>Registro de entradas e historial</Text>
            </View>
            <TouchableOpacity style={styles.refreshIconBtn} onPress={cargarDatos} disabled={guardandoEntrada}>
              <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Proveedores activos</Text>
            <Text style={styles.kpiValue}>{proveedoresActivos}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Entradas cargadas</Text>
            <Text style={styles.kpiValue}>{historialCompras.length}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registrar Entrada</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Proveedor *</Text>
          <View style={styles.choiceWrap}>
            {proveedoresActivosLista.map((prov) => {
              const selected = String(prov.id_proveedor) === String(proveedorEntradaId);
              return (
                <TouchableOpacity
                  key={prov.id_proveedor}
                  style={[styles.choicePill, selected ? styles.choicePillOn : null]}
                  onPress={() => setProveedorEntradaId(String(prov.id_proveedor))}
                >
                  <Text style={[styles.choicePillText, selected ? styles.choicePillTextOn : null]}>
                    {prov.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Producto del proveedor *</Text>
          <View style={styles.productBox}>
            {!proveedorEntradaId ? (
              <Text style={styles.emptyText}>Selecciona un proveedor para ver productos.</Text>
            ) : !productosEntradaDisponibles.length ? (
              <Text style={styles.emptyText}>Este proveedor no tiene productos asignados.</Text>
            ) : (
              productosEntradaDisponibles.map((item) => {
                const selected = Boolean(productosEntradaSeleccion[String(item.id_producto)]?.checked);
                return (
                  <TouchableOpacity
                    key={`${item.id_producto_proveedor}-${item.id_producto}`}
                    style={[styles.entryProductItem, selected ? styles.entryProductItemOn : null]}
                    onPress={() => toggleProductoEntrada(item.id_producto)}
                  >
                    <View>
                      <Text style={[styles.productName, selected ? styles.entryProductNameOn : null]}>{item.nombre}</Text>
                      <Text style={styles.productMeta}>Precio compra: ${Number(item.precio_compra || 0).toFixed(2)}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkbox-outline" : "square-outline"}
                      size={18}
                      color={selected ? "#166534" : "#94a3b8"}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <Text style={styles.helperText}>Seleccionados: {productosEntradaSeleccionados.length}</Text>

          {productosEntradaSeleccionados.length ? (
            <View style={styles.qtyList}>
              {productosEntradaSeleccionados.map((item) => (
                <View key={`qty-${item.id_producto}`} style={styles.qtyItem}>
                  <View style={styles.qtyMeta}>
                    <Text style={styles.qtyName}>{item.nombre}</Text>
                    <Text style={styles.qtySubtotal}>Subtotal: ${(Number(item.precio_compra || 0) * Number(item.cantidad || 0)).toFixed(2)}</Text>
                  </View>
                  <TextInput
                    style={styles.qtyInput}
                    value={String(productosEntradaSeleccion[String(item.id_producto)]?.cantidad ?? "")}
                    onChangeText={(value) => actualizarCantidadProductoEntrada(item.id_producto, value)}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>Total estimado</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>${totalEntrada.toFixed(2)}</Text>
          </View>

          <Text style={styles.label}>Observacion</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={observacionEntrada}
            onChangeText={setObservacionEntrada}
            multiline
            placeholder="Compra de reposicion"
          />

          {mensajeEntrada ? <Text style={styles.error}>{mensajeEntrada}</Text> : null}

          <TouchableOpacity
            style={[styles.saveButtonBlue, guardandoEntrada ? styles.saveDisabled : null]}
            onPress={registrarEntrada}
            disabled={guardandoEntrada}
          >
            {guardandoEntrada ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>Registrar Entrada</Text>}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { marginBottom: 20 }]}>
          <Text style={styles.cardTitle}>Historial de Entradas</Text>

          <View style={styles.historialListBox}>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              contentContainerStyle={styles.historialListContent}
            >
              {!historialCompras.length ? (
                <Text style={styles.emptyText}>Sin entradas registradas.</Text>
              ) : historialCompras.map((compra) => (
                <View key={compra.key} style={styles.providerItem}>
                  <Text style={styles.providerTitle}>
                    {compra.items.length > 1
                      ? `${compra.items[0]?.producto || "-"} +${compra.items.length - 1} más`
                      : (compra.items[0]?.producto || "-")}
                  </Text>
                  <Text style={styles.providerInfo}>Proveedor: {compra.proveedor}</Text>
                  <Text style={styles.providerInfo}>Cantidad total: {compra.cantidadTotal} | Total compra: ${Number(compra.total || 0).toFixed(2)}</Text>
                  <Text style={styles.providerInfo}>Fecha: {formatearFecha(compra.fecha)}</Text>

                  <TouchableOpacity style={styles.detailButton} onPress={() => abrirDetalleCompra(compra)}>
                    <Text style={styles.detailButtonText}>Ver detalle</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <Modal
          visible={detalleVisible}
          transparent
          animationType="fade"
          onRequestClose={cerrarDetalleCompra}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detalle de compra</Text>
                <TouchableOpacity onPress={cerrarDetalleCompra} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color="#334155" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.providerInfo}>Proveedor: {compraDetalle?.proveedor || "-"}</Text>
                <Text style={styles.providerInfo}>Fecha: {formatearFecha(compraDetalle?.fecha)}</Text>
                <Text style={styles.providerInfo}>Usuario: {compraDetalle?.usuario || "Admin"}</Text>
                <Text style={styles.providerInfo}>Observacion: {compraDetalle?.observacion || "-"}</Text>

                <View style={styles.modalItemsWrap}>
                  {(compraDetalle?.items || []).map((item, idx) => (
                    <View key={`detalle-item-${idx}`} style={styles.modalItemRow}>
                      <Text style={styles.modalItemName}>{item.producto}</Text>
                      <Text style={styles.modalItemMeta}>Cant: {item.cantidad} | PU: ${Number(item.precio_compra || 0).toFixed(2)}</Text>
                      <Text style={styles.modalItemSubtotal}>Subtotal: ${Number(item.subtotal || 0).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.modalTotalBox}>
                  <Text style={styles.modalTotalText}>Total compra: ${Number(compraDetalle?.total || 0).toFixed(2)}</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { backgroundColor: "#2c4da7", padding: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  headerTitle: { color: "white", fontSize: 20, fontWeight: "bold" },
  headerSubtitle: { color: "#dbeafe", marginTop: 4 },
  refreshIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  kpiRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingHorizontal: 16 },
  kpiCard: { width: "48%", backgroundColor: "white", borderRadius: 12, padding: 14, borderLeftWidth: 5, borderLeftColor: "#16a34a" },
  kpiLabel: { color: "#64748b", fontSize: 12 },
  kpiValue: { color: "#0f172a", fontSize: 24, fontWeight: "700", marginTop: 4 },
  card: { backgroundColor: "white", marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  label: { color: "#334155", fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "white" },
  textarea: { minHeight: 64, textAlignVertical: "top" },
  productBox: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, marginTop: 8, overflow: "hidden" },
  productName: { fontWeight: "600", color: "#0f172a" },
  productMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  saveButtonBlue: { marginTop: 12, backgroundColor: "#1d4ed8", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  saveDisabled: { opacity: 0.75 },
  saveText: { color: "white", fontWeight: "700" },
  error: { marginTop: 10, color: "#b91c1c", fontSize: 13, fontWeight: "500" },
  emptyText: { color: "#64748b", padding: 10 },
  helperText: { color: "#475569", fontSize: 12, marginTop: 8 },
  qtyList: { marginTop: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, overflow: "hidden" },
  qtyItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  qtyMeta: { flex: 1, marginRight: 10 },
  qtyName: { flex: 1, color: "#334155", fontWeight: "600", marginRight: 10 },
  qtySubtotal: { color: "#1e40af", fontSize: 12, fontWeight: "600", marginTop: 2 },
  qtyInput: { width: 90, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, textAlign: "right", backgroundColor: "white" },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  choicePill: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "white", marginRight: 8, marginBottom: 8 },
  choicePillOn: { backgroundColor: "#dcfce7", borderColor: "#16a34a" },
  choicePillText: { color: "#334155", fontWeight: "600", fontSize: 12 },
  choicePillTextOn: { color: "#166534" },
  entryProductItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", padding: 10 },
  entryProductItemOn: { backgroundColor: "#f0fdf4" },
  entryProductNameOn: { color: "#166534" },
  totalBox: { borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 10, backgroundColor: "#eff6ff", paddingVertical: 12, alignItems: "center" },
  totalText: { color: "#1e40af", fontWeight: "700", fontSize: 18 },
  providerItem: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, marginTop: 8 },
  historialListBox: { maxHeight: 320, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#f8fafc", overflow: "hidden" },
  historialListContent: { padding: 8, paddingBottom: 10 },
  providerTitle: { fontWeight: "700", color: "#0f172a" },
  providerInfo: { marginTop: 3, color: "#64748b", fontSize: 12 },
  detailButton: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  detailButtonText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: "white", borderRadius: 14, maxHeight: "85%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  modalBody: { paddingHorizontal: 14, paddingVertical: 10 },
  modalItemsWrap: { marginTop: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, overflow: "hidden" },
  modalItemRow: { paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalItemName: { color: "#0f172a", fontWeight: "700" },
  modalItemMeta: { color: "#64748b", fontSize: 12, marginTop: 2 },
  modalItemSubtotal: { color: "#1e40af", fontSize: 12, fontWeight: "700", marginTop: 3 },
  modalTotalBox: { marginTop: 12, marginBottom: 14, backgroundColor: "#eff6ff", borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", paddingVertical: 10, alignItems: "center" },
  modalTotalText: { color: "#1e40af", fontWeight: "700", fontSize: 15 }
});

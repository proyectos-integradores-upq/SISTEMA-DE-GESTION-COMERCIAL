import { SafeAreaView } from "react-native-safe-area-context";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiCandidates } from "../config/api";
import { clearSession, getStoredToken } from "../utils/authStorage";

export default function ProveedoresScreen({ navigation }) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [proveedores, setProveedores] = useState([]);
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [productosPorProveedor, setProductosPorProveedor] = useState({});

  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [rfc, setRfc] = useState("");
  const [direccion, setDireccion] = useState("");
  const [estado, setEstado] = useState("Activo");
  const [seleccion, setSeleccion] = useState({});
  const [idProveedorEdit, setIdProveedorEdit] = useState(null);

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

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const headers = await getHeaders(false);
      if (!headers) return;

      const baseUrl = apiBaseUrl || (await resolverApiBase());
      setApiBaseUrl(baseUrl);

      const [resProv, resProd] = await Promise.all([
        fetch(`${baseUrl}/api/proveedores`, { method: "GET", headers }),
        fetch(`${baseUrl}/api/productos`, { method: "GET", headers })
      ]);

      if (!resProv.ok || !resProd.ok) throw new Error("Error al cargar datos");

      const provData = await resProv.json();
      const prodData = await resProd.json();

      const provArray = Array.isArray(provData) ? provData : [];
      const prodArray = Array.isArray(prodData) ? prodData : [];

      setProveedores(provArray);
      setCatalogoProductos(prodArray);

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
    } catch {
      setError("No se pudo cargar el módulo de proveedores.");
    } finally {
      setCargando(false);
    }
  }, [apiBaseUrl, getHeaders, resolverApiBase]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const proveedoresActivos = useMemo(
    () => proveedores.filter((item) => String(item?.estado || "").toLowerCase() === "activo").length,
    [proveedores]
  );

  const coberturaCatalogo = useMemo(() => {
    const totalProductos = catalogoProductos.length;
    const cubiertos = new Set();

    Object.values(productosPorProveedor).forEach((lista) => {
      (Array.isArray(lista) ? lista : []).forEach((item) => {
        const id = Number(item?.id_producto || 0);
        if (id > 0) cubiertos.add(id);
      });
    });

    const totalCubiertos = cubiertos.size;
    const porcentaje = totalProductos > 0 ? Math.round((totalCubiertos * 100) / totalProductos) : 0;

    return {
      porcentaje,
      texto: `${totalCubiertos} de ${totalProductos} productos cubiertos`
    };
  }, [catalogoProductos, productosPorProveedor]);

  const productosSeleccionados = useMemo(() => {
    return Object.entries(seleccion)
      .filter(([, value]) => value?.checked)
      .map(([id, value]) => ({
        id_producto: Number(id),
        precio_compra: Number(value?.precio || 0)
      }));
  }, [seleccion]);

  const toggleProducto = (idProducto) => {
    setSeleccion((prev) => {
      const key = String(idProducto);
      const current = prev[key] || { checked: false, precio: "" };

      return {
        ...prev,
        [key]: {
          checked: !current.checked,
          precio: !current.checked ? (current.precio || "0.01") : ""
        }
      };
    });
  };

  const actualizarPrecio = (idProducto, precio) => {
    setSeleccion((prev) => ({
      ...prev,
      [String(idProducto)]: {
        ...(prev[String(idProducto)] || { checked: true }),
        checked: true,
        precio
      }
    }));
  };

  const limpiarFormulario = () => {
    setNombre("");
    setEmpresa("");
    setTelefono("");
    setCorreo("");
    setRfc("");
    setDireccion("");
    setEstado("Activo");
    setSeleccion({});
    setIdProveedorEdit(null);
  };

  const cargarProveedorEnFormulario = (proveedor) => {
    if (!proveedor) return;

    setIdProveedorEdit(Number(proveedor.id_proveedor));
    setNombre(proveedor.nombre || "");
    setEmpresa(proveedor.empresa || "");
    setTelefono(proveedor.telefono || "");
    setCorreo(proveedor.correo || "");
    setRfc(proveedor.rfc || "");
    setDireccion(proveedor.direccion || "");
    setEstado(proveedor.estado || "Activo");

    const lista = productosPorProveedor[String(proveedor.id_proveedor)] || [];
    const map = {};

    lista.forEach((item) => {
      if (!item?.id_producto) return;

      map[String(item.id_producto)] = {
        checked: true,
        precio: String(item.precio_compra ?? "")
      };
    });

    setSeleccion(map);
  };

  const verProveedorDetalle = (proveedor) => {
    if (!proveedor?.id_proveedor) return;

    const lista = productosPorProveedor[String(proveedor.id_proveedor)] || [];
    const productosTexto = lista.length
      ? lista.map((item) => `- ${item.nombre || "Producto"} ($${Number(item.precio_compra || 0).toFixed(2)})`).join("\n")
      : "Sin productos asignados.";

    Alert.alert(
      `Proveedor: ${proveedor.nombre || "-"}`,
      [
        `Empresa: ${proveedor.empresa || "-"}`,
        `Estado: ${proveedor.estado || "-"}`,
        `Teléfono: ${proveedor.telefono || "-"}`,
        `Correo: ${proveedor.correo || "-"}`,
        "",
        "Productos asignados:",
        productosTexto
      ].join("\n")
    );
  };

  const eliminarProveedor = (proveedor) => {
    if (!proveedor?.id_proveedor) return;

    Alert.alert(
      "Eliminar proveedor",
      `¿Eliminar proveedor ${proveedor.nombre || "seleccionado"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await getHeaders(false);
              if (!headers) return;

              const baseUrl = apiBaseUrl || (await resolverApiBase());
              setApiBaseUrl(baseUrl);

              const res = await fetch(`${baseUrl}/api/proveedores/${proveedor.id_proveedor}`, {
                method: "DELETE",
                headers
              });

              const data = await res.json();
              if (!res.ok) {
                setMensaje(data?.message || "No se pudo eliminar el proveedor.");
                return;
              }

              if (Number(idProveedorEdit) === Number(proveedor.id_proveedor)) {
                limpiarFormulario();
              }

              await cargarDatos();
              Alert.alert("Proveedores", data?.message || "Accion ejecutada correctamente.");
            } catch {
              setMensaje("Error de conexión al eliminar proveedor.");
            }
          }
        }
      ]
    );
  };

  const guardarProveedor = async () => {
    if (!nombre.trim() || !empresa.trim()) {
      setMensaje("Nombre y empresa son obligatorios.");
      return;
    }

    if (!productosSeleccionados.length) {
      setMensaje("Selecciona al menos un producto del catálogo.");
      return;
    }

    if (productosSeleccionados.some((p) => !Number.isFinite(p.precio_compra) || p.precio_compra <= 0)) {
      setMensaje("Todos los productos seleccionados requieren precio > 0.");
      return;
    }

    try {
      setGuardando(true);
      setMensaje("");

      const headers = await getHeaders(true);
      if (!headers) return;

      const baseUrl = apiBaseUrl || (await resolverApiBase());
      setApiBaseUrl(baseUrl);

      const creando = !idProveedorEdit;

      const payload = {
        nombre: nombre.trim(),
        empresa: empresa.trim(),
        telefono: telefono.trim() || null,
        correo: correo.trim() || null,
        rfc: rfc.trim() || null,
        direccion: direccion.trim() || null,
        estado: creando ? "Activo" : estado
      };
      const endpoint = creando
        ? `${baseUrl}/api/proveedores`
        : `${baseUrl}/api/proveedores/${idProveedorEdit}`;

      const resCreate = await fetch(endpoint, {
        method: creando ? "POST" : "PUT",
        headers,
        body: JSON.stringify(payload)
      });

      const dataCreate = await resCreate.json();
      if (!resCreate.ok || !dataCreate?.id_proveedor) {
        setMensaje(dataCreate?.message || "No se pudo crear el proveedor.");
        return;
      }

      const resSync = await fetch(`${baseUrl}/api/proveedores/${dataCreate.id_proveedor}/productos`, {
        method: "POST",
        headers,
        body: JSON.stringify({ productos: productosSeleccionados })
      });

      const dataSync = await resSync.json();
      if (!resSync.ok) {
        setMensaje(dataSync?.message || "Proveedor guardado, pero no se pudo asignar productos.");
        return;
      }

      limpiarFormulario();
      await cargarDatos();
      Alert.alert("Proveedores", creando ? "Proveedor registrado correctamente." : "Proveedor actualizado correctamente.");
    } catch {
      setMensaje("Error de conexión al guardar proveedor.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Proveedores</Text>
              <Text style={styles.headerSubtitle}>Gestión de proveedores y sus productos</Text>
            </View>
            <TouchableOpacity style={styles.refreshIconBtn} onPress={cargarDatos} disabled={cargando}>
              {cargando ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Proveedores activos</Text>
            <Text style={styles.kpiValue}>{proveedoresActivos}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Cobertura del catálogo</Text>
            <Text style={styles.kpiValue}>{coberturaCatalogo.porcentaje}%</Text>
            <Text style={styles.kpiHint}>{coberturaCatalogo.texto}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{idProveedorEdit ? "Editar Proveedor" : "Agregar Proveedor"}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Nombre contacto *</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Maria Lopez" />

          <Text style={styles.label}>Empresa *</Text>
          <TextInput style={styles.input} value={empresa} onChangeText={setEmpresa} placeholder="Distribuidora Andina" />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="555 333 2211" />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Correo</Text>
              <TextInput style={styles.input} value={correo} onChangeText={setCorreo} placeholder="contacto@empresa.com" autoCapitalize="none" keyboardType="email-address" />
            </View>
          </View>

          <Text style={styles.label}>RFC</Text>
          <TextInput style={styles.input} value={rfc} onChangeText={setRfc} placeholder="XAXX010101000" />

          {idProveedorEdit ? (
            <>
              <Text style={styles.label}>Estado</Text>
              <View style={styles.pillRow}>
                <TouchableOpacity style={[styles.pill, estado === "Activo" ? styles.pillOn : null]} onPress={() => setEstado("Activo")}>
                  <Text style={[styles.pillText, estado === "Activo" ? styles.pillTextOn : null]}>Activo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pill, estado === "Inactivo" ? styles.pillOn : null]} onPress={() => setEstado("Inactivo")}>
                  <Text style={[styles.pillText, estado === "Inactivo" ? styles.pillTextOn : null]}>Inactivo</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Dirección</Text>
          <TextInput style={[styles.input, styles.textarea]} value={direccion} onChangeText={setDireccion} multiline placeholder="Calle, número, colonia, ciudad" />

          <Text style={styles.label}>Productos que vende *</Text>
          {cargando ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.loadingText}>Cargando productos...</Text>
            </View>
          ) : (
            <View style={styles.productBox}>
              {catalogoProductos.map((p) => {
                const key = String(p.id_producto);
                const checked = seleccion[key]?.checked;
                const precio = seleccion[key]?.precio || "";

                return (
                  <View key={p.id_producto} style={styles.productRow}>
                    <TouchableOpacity style={styles.productLeft} onPress={() => toggleProducto(p.id_producto)}>
                      <Ionicons name={checked ? "checkbox-outline" : "square-outline"} size={20} color={checked ? "#16a34a" : "#64748b"} />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.productName}>{p.nombre}</Text>
                        <Text style={styles.productMeta}>{p.codigo || "Sin código"}</Text>
                      </View>
                    </TouchableOpacity>

                    <TextInput
                      style={[styles.priceInput, !checked ? styles.priceInputOff : null]}
                      value={precio}
                      editable={Boolean(checked)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      onChangeText={(value) => actualizarPrecio(p.id_producto, value)}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {mensaje ? <Text style={styles.error}>{mensaje}</Text> : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.saveButton, styles.actionBtn, guardando ? styles.saveDisabled : null]} onPress={guardarProveedor} disabled={guardando}>
              {guardando ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>{idProveedorEdit ? "Guardar cambios" : "Registrar Proveedor"}</Text>}
            </TouchableOpacity>

            {idProveedorEdit ? (
              <TouchableOpacity style={[styles.cancelButton, styles.actionBtn]} onPress={limpiarFormulario}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={[styles.card, { marginBottom: 20 }]}> 
          <Text style={styles.cardTitle}>Proveedores registrados</Text>
          <View style={styles.providersListBox}>
            {!proveedores.length ? (
              <Text style={styles.providersEmpty}>Aún no hay proveedores registrados.</Text>
            ) : (
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                contentContainerStyle={styles.providersListContent}
              >
                {proveedores.map((prov) => {
                  const count = (productosPorProveedor[String(prov.id_proveedor)] || []).length;
                  return (
                    <View key={prov.id_proveedor} style={styles.providerItem}>
                      <Text style={styles.providerTitle}>{prov.nombre} - {prov.empresa || "Sin empresa"}</Text>
                      <Text style={styles.providerInfo}>Productos asignados: {count}</Text>

                      <View style={styles.providerActions}>
                        <TouchableOpacity style={styles.viewBtn} onPress={() => verProveedorDetalle(prov)}>
                          <Text style={styles.viewBtnText}>Ver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editBtn} onPress={() => cargarProveedorEnFormulario(prov)}>
                          <Text style={styles.editBtnText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => eliminarProveedor(prov)}>
                          <Text style={styles.deleteBtnText}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
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
  kpiHint: { color: "#64748b", fontSize: 11, marginTop: 4 },
  card: { backgroundColor: "white", marginHorizontal: 16, marginTop: 14, borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  label: { color: "#334155", fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "white" },
  textarea: { minHeight: 64, textAlignVertical: "top" },
  row: { flexDirection: "row", marginTop: 4 },
  col: { flex: 1, marginRight: 8 },
  pillRow: { flexDirection: "row" },
  pill: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  pillOn: { borderColor: "#16a34a", backgroundColor: "#dcfce7" },
  pillText: { color: "#334155", fontWeight: "600" },
  pillTextOn: { color: "#166534" },
  productBox: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, marginTop: 8, overflow: "hidden" },
  productRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", padding: 10 },
  productLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  productName: { fontWeight: "600", color: "#0f172a" },
  productMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  priceInput: { width: 90, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, textAlign: "right" },
  priceInputOff: { backgroundColor: "#f1f5f9" },
  saveButton: { marginTop: 12, backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  actionsRow: { flexDirection: "row", marginTop: 12 },
  actionBtn: { flex: 1 },
  cancelButton: { marginLeft: 8, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#e2e8f0" },
  cancelText: { color: "#334155", fontWeight: "700" },
  saveDisabled: { opacity: 0.75 },
  saveText: { color: "white", fontWeight: "700" },
  error: { marginTop: 10, color: "#b91c1c", fontSize: 13, fontWeight: "500" },
  loadingRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  loadingText: { marginLeft: 8, color: "#64748b" },
  providersListBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    maxHeight: 320,
    minHeight: 80
  },
  providersListContent: { padding: 8 },
  providersEmpty: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 12
  },
  providerItem: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: "white" },
  providerTitle: { fontWeight: "700", color: "#0f172a" },
  providerInfo: { marginTop: 3, color: "#64748b", fontSize: 12 },
  providerActions: { flexDirection: "row", marginTop: 10 },
  viewBtn: { backgroundColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  viewBtnText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  editBtn: { backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  editBtnText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  deleteBtn: { backgroundColor: "#fee2e2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700", fontSize: 12 }
});
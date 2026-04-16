import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { getApiCandidates } from "../config/api";
import { clearSession, getStoredToken } from "../utils/authStorage";

export default function ProductosScreen({ navigation }) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [modalNuevoVisible, setModalNuevoVisible] = useState(false);
  const [modoModalProducto, setModoModalProducto] = useState("crear");
  const [productoEditandoId, setProductoEditandoId] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [descripcionNueva, setDescripcionNueva] = useState("");
  const [imagenNueva, setImagenNueva] = useState(null);
  const [imagenActualEdicion, setImagenActualEdicion] = useState(null);
  const [precioNuevo, setPrecioNuevo] = useState("");
  const [stockNuevo, setStockNuevo] = useState("");
  const [categoriaNuevaId, setCategoriaNuevaId] = useState(null);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [mensajeModalNuevo, setMensajeModalNuevo] = useState("");
  const [imagenesFallidas, setImagenesFallidas] = useState({});
  const [modalCategoriaVisible, setModalCategoriaVisible] = useState(false);
  const [nombreCategoriaNueva, setNombreCategoriaNueva] = useState("");
  const [descripcionCategoriaNueva, setDescripcionCategoriaNueva] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [mensajeModalCategoria, setMensajeModalCategoria] = useState("");
  const [categoriaEditandoId, setCategoriaEditandoId] = useState(null);
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [categoriaFiltroId, setCategoriaFiltroId] = useState(null);

  const resolverApiBase = useCallback(async () => {
    const candidatos = getApiCandidates();

    for (const baseUrl of candidatos) {
      try {
        const response = await fetch(`${baseUrl}/api/test`, { method: "GET" });

        if (response.ok) {
          return baseUrl;
        }
      } catch {
        // Try next base URL.
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
        Authorization: `Bearer ${token}`
      };

      const productosResponse = await fetch(`${baseUrl}/api/productos`, { method: "GET", headers });

      if (productosResponse.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!productosResponse.ok) {
        throw new Error("No se pudieron cargar productos");
      }

      const productosData = await productosResponse.json();
      setProductos(Array.isArray(productosData) ? productosData : []);

      try {
        const categoriasResponse = await fetch(`${baseUrl}/api/categorias`, { method: "GET", headers });

        if (categoriasResponse.status === 401) {
          await clearSession();
          navigation.replace("Login");
          return;
        }

        if (!categoriasResponse.ok) {
          setCategorias([]);
        } else {
          const categoriasData = await categoriasResponse.json();
          setCategorias(Array.isArray(categoriasData) ? categoriasData : []);
        }
      } catch {
        setCategorias([]);
      }

      setImagenesFallidas({});
    } catch {
      setErrorCarga("No se pudo cargar la informacion. Revisa el backend.");
    } finally {
      setCargando(false);
    }
  }, [apiBaseUrl, navigation, resolverApiBase]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return productos.filter((item) => {
      const coincideStock = !soloStockBajo || Number(item.stock || 0) < 5;
      const coincideCategoria = !categoriaFiltroId || Number(item.id_categoria) === Number(categoriaFiltroId);

      const nombre = String(item.nombre || "").toLowerCase();
      const codigo = String(item.codigo || "").toLowerCase();

      const coincideTexto = !texto || nombre.includes(texto) || codigo.includes(texto);

      return coincideStock && coincideCategoria && coincideTexto;
    });
  }, [busqueda, productos, soloStockBajo, categoriaFiltroId]);

  const totalProductos = productos.length;
  const totalStockBajo = productos.filter((item) => Number(item.stock || 0) < 5).length;

  const resolverImagen = useCallback(
    (producto) => {
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
    },
    [apiBaseUrl]
  );

  const renderImagen = (producto) => {
    if (imagenesFallidas[producto?.id_producto]) {
      return (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={20} color="#94a3b8" />
        </View>
      );
    }

    const imagenUrl = resolverImagen(producto);

    if (!imagenUrl) {
      return (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={20} color="#94a3b8" />
        </View>
      );
    }

    return (
      <Image
        source={{ uri: imagenUrl }}
        style={styles.image}
        onError={() => {
          setImagenesFallidas((prev) => ({
            ...prev,
            [producto?.id_producto]: true
          }));
        }}
      />
    );
  };

  const abrirModalNuevo = () => {
    setModoModalProducto("crear");
    setProductoEditandoId(null);
    setNombreNuevo("");
    setDescripcionNueva("");
    setImagenNueva(null);
    setImagenActualEdicion(null);
    setPrecioNuevo("");
    setStockNuevo("");
    setCategoriaNuevaId(categorias[0]?.id_categoria || null);
    setMensajeModalNuevo("");
    setModalNuevoVisible(true);
  };

  const abrirModalEditar = (producto) => {
    setModoModalProducto("editar");
    setProductoEditandoId(producto.id_producto);
    setNombreNuevo(String(producto.nombre || ""));
    setDescripcionNueva(String(producto.descripcion || ""));
    setImagenNueva(null);
    setImagenActualEdicion(resolverImagen(producto));
    setPrecioNuevo(String(producto.precio || ""));
    setStockNuevo(String(producto.stock || ""));
    setCategoriaNuevaId(producto.id_categoria || categorias[0]?.id_categoria || null);
    setMensajeModalNuevo("");
    setModalNuevoVisible(true);
  };

  const cerrarModalNuevo = () => {
    if (guardandoNuevo) {
      return;
    }

    setModalNuevoVisible(false);
    setMensajeModalNuevo("");
  };

  const abrirModalCategoria = () => {
    setNombreCategoriaNueva("");
    setDescripcionCategoriaNueva("");
    setMensajeModalCategoria("");
    setCategoriaEditandoId(null);
    setModalCategoriaVisible(true);
  };

  const cerrarModalCategoria = () => {
    if (guardandoCategoria) {
      return;
    }

    setModalCategoriaVisible(false);
    setMensajeModalCategoria("");
    setCategoriaEditandoId(null);
  };

  const editarCategoria = (categoria) => {
    if (!categoria?.id_categoria) {
      return;
    }

    setCategoriaEditandoId(categoria.id_categoria);
    setNombreCategoriaNueva(String(categoria.nombre || ""));
    setDescripcionCategoriaNueva(String(categoria.descripcion || ""));
    setMensajeModalCategoria(`Editando categoría: ${categoria.nombre || ""}`);
  };

  const guardarCategoria = async () => {
    const nombre = nombreCategoriaNueva.trim();

    if (!nombre) {
      setMensajeModalCategoria("El nombre de la categoría es obligatorio.");
      return;
    }

    try {
      setGuardandoCategoria(true);
      setMensajeModalCategoria("");

      const token = await getStoredToken();

      if (!token) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      const baseUrl = apiBaseUrl || (await resolverApiBase());
      setApiBaseUrl(baseUrl);

      const enEdicion = Boolean(categoriaEditandoId);
      const endpoint = enEdicion
        ? `${baseUrl}/api/categorias/${categoriaEditandoId}`
        : `${baseUrl}/api/categorias`;

      const response = await fetch(endpoint, {
        method: enEdicion ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre,
          descripcion: descripcionCategoriaNueva.trim()
        })
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        const primerError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
        setMensajeModalCategoria(primerError || data?.message || "No se pudo guardar la categoría.");
        return;
      }

      setModalCategoriaVisible(false);
      await cargarDatos();
      if (!enEdicion && data?.id_categoria) {
        setCategoriaNuevaId(data.id_categoria);
      }
      setCategoriaEditandoId(null);
      Alert.alert("Categorías", enEdicion ? "Categoría actualizada correctamente." : "Categoría creada correctamente.");
    } catch {
      setMensajeModalCategoria("Error de conexión al guardar categoría.");
    } finally {
      setGuardandoCategoria(false);
    }
  };

  const eliminarCategoria = async (categoria) => {
    if (!categoria?.id_categoria) {
      return;
    }

    Alert.alert(
      "Eliminar categoría",
      `¿Seguro que deseas eliminar ${categoria.nombre || "esta categoría"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getStoredToken();

              if (!token) {
                await clearSession();
                navigation.replace("Login");
                return;
              }

              const baseUrl = apiBaseUrl || (await resolverApiBase());
              setApiBaseUrl(baseUrl);

              const response = await fetch(`${baseUrl}/api/categorias/${categoria.id_categoria}`, {
                method: "DELETE",
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`
                }
              });

              let data = null;
              try {
                data = await response.json();
              } catch {
                data = null;
              }

              if (response.status === 401) {
                await clearSession();
                navigation.replace("Login");
                return;
              }

              if (!response.ok) {
                Alert.alert("Categorías", data?.message || "No se pudo eliminar la categoría.");
                return;
              }

              await cargarDatos();
              if (Number(categoriaNuevaId) === Number(categoria.id_categoria)) {
                setCategoriaNuevaId(null);
              }
              if (Number(categoriaFiltroId) === Number(categoria.id_categoria)) {
                setCategoriaFiltroId(null);
              }

              Alert.alert("Categorías", data?.message || "Categoría eliminada correctamente.");
            } catch {
              Alert.alert("Categorías", "Error de conexión al eliminar categoría.");
            }
          }
        }
      ]
    );
  };

  const eliminarProducto = async (producto) => {
    Alert.alert(
      "Eliminar producto",
      `¿Seguro que deseas eliminar ${producto.nombre || "este producto"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getStoredToken();

              if (!token) {
                await clearSession();
                navigation.replace("Login");
                return;
              }

              const baseUrl = apiBaseUrl || (await resolverApiBase());
              setApiBaseUrl(baseUrl);

              const response = await fetch(`${baseUrl}/api/productos/${producto.id_producto}`, {
                method: "DELETE",
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`
                }
              });

              let data = null;
              try {
                data = await response.json();
              } catch {
                data = null;
              }

              if (response.status === 401) {
                await clearSession();
                navigation.replace("Login");
                return;
              }

              if (!response.ok) {
                Alert.alert("Productos", data?.message || "No se pudo eliminar el producto.");
                return;
              }

              await cargarDatos();
              Alert.alert("Productos", "Producto eliminado correctamente.");
            } catch {
              Alert.alert("Productos", "Error de conexión al eliminar.");
            }
          }
        }
      ]
    );
  };

  const seleccionarImagenNueva = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permiso.granted) {
        Alert.alert("Permiso requerido", "Necesitas permitir acceso a la galeria para seleccionar una imagen.");
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8
      });

      if (resultado.canceled || !resultado.assets || !resultado.assets.length) {
        return;
      }

      const asset = resultado.assets[0];
      const maxBytes = 2 * 1024 * 1024;

      if (asset.fileSize && asset.fileSize > maxBytes) {
        setMensajeModalNuevo("La imagen no puede superar 2MB.");
        return;
      }

      setImagenNueva(asset);
      setImagenActualEdicion(null);
      setMensajeModalNuevo("");
    } catch {
      setMensajeModalNuevo("No se pudo seleccionar la imagen.");
    }
  };

  const guardarNuevoProducto = async () => {
    const nombre = nombreNuevo.trim();
    const precio = Number(precioNuevo);
    const stock = Number(stockNuevo);

    if (!nombre) {
      setMensajeModalNuevo("El nombre es obligatorio.");
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      setMensajeModalNuevo("Ingresa un precio válido.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setMensajeModalNuevo("Ingresa un stock válido.");
      return;
    }

    if (!categoriaNuevaId) {
      setMensajeModalNuevo("Selecciona una categoría.");
      return;
    }

    try {
      setGuardandoNuevo(true);
      setMensajeModalNuevo("");

      const token = await getStoredToken();

      if (!token) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      const baseUrl = apiBaseUrl || (await resolverApiBase());
      setApiBaseUrl(baseUrl);

      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("descripcion", descripcionNueva.trim());
      formData.append("precio", String(precio));
      formData.append("stock", String(stock));
      formData.append("id_categoria", String(Number(categoriaNuevaId)));

      if (modoModalProducto === "editar") {
        formData.append("_method", "PUT");
      }

      if (imagenNueva?.uri) {
        const ext = imagenNueva.uri.split(".").pop() || "jpg";
        const mime = imagenNueva.mimeType || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");

        formData.append("imagen", {
          uri: imagenNueva.uri,
          name: imagenNueva.fileName || `producto.${ext}`,
          type: mime
        });
      }

      const endpoint = modoModalProducto === "editar"
        ? `${baseUrl}/api/productos/${productoEditandoId}`
        : `${baseUrl}/api/productos`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        const primerError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
        setMensajeModalNuevo(primerError || data?.message || "No se pudo guardar el producto.");
        return;
      }

      setModalNuevoVisible(false);
      await cargarDatos();
      Alert.alert("Productos", modoModalProducto === "editar" ? "Producto actualizado correctamente." : "Producto creado correctamente.");
    } catch {
      setMensajeModalNuevo("Error de conexión al guardar.");
    } finally {
      setGuardandoNuevo(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Productos</Text>
              <Text style={styles.headerSubtitle}>Administra tu inventario y categorias</Text>
            </View>
            <TouchableOpacity style={styles.refreshIconBtn} onPress={cargarDatos} disabled={cargando}>
              {cargando ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.pageHeader}>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.btnNuevo} onPress={abrirModalNuevo}>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.btnNuevoText}>Nuevo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnCategoria} onPress={abrirModalCategoria}>
                <Ionicons name="pricetags-outline" size={16} color="white" />
                <Text style={styles.btnNuevoText}>Categoría</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.stats}>
            <TouchableOpacity
              style={[styles.statCard, !soloStockBajo ? styles.statCardActiva : null]}
              onPress={() => setSoloStockBajo(false)}
              activeOpacity={0.9}
            >
              <View>
                <Text style={styles.statLabel}>Total de Productos</Text>
                <Text style={styles.statNumber}>{totalProductos}</Text>
                <Text style={styles.statHintUp}>En catálogo</Text>
              </View>

              <View style={[styles.statIcon, styles.statIconBlue]}>
                <Ionicons name="cube-outline" size={20} color="white" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, soloStockBajo ? styles.statCardActiva : null]}
              onPress={() => setSoloStockBajo(true)}
              activeOpacity={0.9}
            >
              <View>
                <Text style={styles.statLabel}>Stock Bajo</Text>
                <Text style={styles.statNumber}>{totalStockBajo}</Text>
                <Text style={styles.statHintDown}>Requiere atencion</Text>
              </View>

              <View style={[styles.statIcon, styles.statIconRed]}>
                <Ionicons name="trending-down-outline" size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.filterCard}>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color="#64748b" />
              <TextInput
                placeholder="Buscar por nombre o código..."
                style={styles.searchInput}
                value={busqueda}
                onChangeText={setBusqueda}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterPill, !categoriaFiltroId ? styles.filterPillActiva : null]}
                onPress={() => setCategoriaFiltroId(null)}
                activeOpacity={0.9}
              >
                <Text style={[styles.filterPillText, !categoriaFiltroId ? styles.filterPillTextActiva : null]}>
                  Todas las categorias
                </Text>
              </TouchableOpacity>

              {categorias.map((categoria) => (
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    Number(categoriaFiltroId) === Number(categoria.id_categoria) ? styles.filterPillActiva : null
                  ]}
                  key={categoria.id_categoria}
                  onPress={() => setCategoriaFiltroId(categoria.id_categoria)}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      Number(categoriaFiltroId) === Number(categoria.id_categoria) ? styles.filterPillTextActiva : null
                    ]}
                  >
                    {categoria.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {cargando ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.emptyText}>Cargando productos...</Text>
            </View>
          ) : null}

          {!cargando && errorCarga ? (
            <TouchableOpacity style={styles.emptyState} onPress={cargarDatos}>
              <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
              <Text style={styles.emptyTextError}>{errorCarga}</Text>
              <Text style={styles.reintentar}>Toca para reintentar</Text>
            </TouchableOpacity>
          ) : null}

          {!cargando && !errorCarga && !productosFiltrados.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={20} color="#94a3b8" />
              <Text style={styles.emptyText}>No hay productos para mostrar.</Text>
            </View>
          ) : null}

          {!cargando && !errorCarga
            ? productosFiltrados.map((item) => {
                const categoria = item?.categoria?.nombre || "Sin categoría";
                const estado = item?.estado?.nombre || "Sin estado";
                const precio = Number(item?.precio || 0).toFixed(2);

                return (
                  <View style={styles.productCard} key={item.id_producto}>
                    {renderImagen(item)}

                    <View style={styles.productInfo}>
                      <View style={styles.productHead}>
                        <Text style={styles.code}>{item.codigo || "-"}</Text>
                        <View style={styles.estadoActivo}>
                          <Text style={styles.estadoText}>{estado}</Text>
                        </View>
                      </View>

                      <Text style={styles.title}>{item.nombre || "Sin nombre"}</Text>

                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{categoria}</Text>
                      </View>

                      <View style={styles.row}>
                        <Text style={styles.price}>${precio}</Text>
                        <Text style={styles.stock}>{Number(item.stock || 0)} unid.</Text>
                      </View>

                      <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => abrirModalEditar(item)}>
                          <Ionicons name="create-outline" size={15} color="#2563eb" />
                          <Text style={styles.actionTextBlue}>Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={() => eliminarProducto(item)}>
                          <Ionicons name="trash-outline" size={15} color="#dc2626" />
                          <Text style={styles.actionTextRed}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            : null}
        </View>
      </ScrollView>

      <Modal
        visible={modalNuevoVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalNuevo}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modoModalProducto === "editar" ? "Editar Producto" : "Nuevo Producto"}</Text>
              <TouchableOpacity onPress={cerrarModalNuevo} disabled={guardandoNuevo}>
                <Ionicons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nombre</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Laptop Dell"
              value={nombreNuevo}
              onChangeText={setNombreNuevo}
            />

            <Text style={styles.modalLabel}>Descripción</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Descripción del producto"
              value={descripcionNueva}
              onChangeText={setDescripcionNueva}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.modalLabel}>Imagen</Text>
            <TouchableOpacity style={styles.modalImageButton} onPress={seleccionarImagenNueva}>
              <Ionicons name="image-outline" size={16} color="#2563eb" />
              <Text style={styles.modalImageButtonText}>Seleccionar imagen</Text>
            </TouchableOpacity>

            {imagenNueva?.uri ? (
              <Image source={{ uri: imagenNueva.uri }} style={styles.modalPreviewImage} />
            ) : null}

            {!imagenNueva?.uri && imagenActualEdicion ? (
              <Image source={{ uri: imagenActualEdicion }} style={styles.modalPreviewImage} />
            ) : null}

            <Text style={styles.modalLabel}>Categoría</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalCategoriasRow}
            >
              {categorias.map((categoria) => {
                const seleccionada = Number(categoriaNuevaId) === Number(categoria.id_categoria);

                return (
                  <TouchableOpacity
                    key={categoria.id_categoria}
                    style={[
                      styles.modalCategoriaBtn,
                      seleccionada ? styles.modalCategoriaBtnActiva : null
                    ]}
                    onPress={() => setCategoriaNuevaId(categoria.id_categoria)}
                  >
                    <Text
                      style={[
                        styles.modalCategoriaText,
                        seleccionada ? styles.modalCategoriaTextActiva : null
                      ]}
                    >
                      {categoria.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalGrid}>
              <View style={styles.modalFieldHalf}>
                <Text style={styles.modalLabel}>Precio</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={precioNuevo}
                  onChangeText={setPrecioNuevo}
                />
              </View>

              <View style={styles.modalFieldHalf}>
                <Text style={styles.modalLabel}>Stock</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0"
                  keyboardType="number-pad"
                  value={stockNuevo}
                  onChangeText={setStockNuevo}
                />
              </View>
            </View>

            <Text style={styles.modalHint}>Codigo y estado se generan automaticamente.</Text>

            {mensajeModalNuevo ? <Text style={styles.modalError}>{mensajeModalNuevo}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={cerrarModalNuevo}
                disabled={guardandoNuevo}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={guardarNuevoProducto}
                disabled={guardandoNuevo}
              >
                {guardandoNuevo ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>{modoModalProducto === "editar" ? "Guardar cambios" : "Guardar"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalCategoriaVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalCategoria}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Categoría</Text>
              <TouchableOpacity onPress={cerrarModalCategoria} disabled={guardandoCategoria}>
                <Ionicons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nombre</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Electronica"
              value={nombreCategoriaNueva}
              onChangeText={setNombreCategoriaNueva}
            />

            <Text style={styles.modalLabel}>Descripción</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Descripción de la categoría"
              value={descripcionCategoriaNueva}
              onChangeText={setDescripcionCategoriaNueva}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.modalSubTitle}>Categorias registradas</Text>

            {!categorias.length ? (
              <Text style={styles.modalCategoriasEmpty}>No hay categorias registradas.</Text>
            ) : (
              <View style={styles.modalCategoriasList}>
                {categorias.map((categoria) => (
                  <View style={styles.modalCategoriaItem} key={categoria.id_categoria}>
                    <View style={styles.modalCategoriaItemInfo}>
                      <Text style={styles.modalCategoriaItemTitle}>{categoria.nombre || "Sin nombre"}</Text>
                      <Text style={styles.modalCategoriaItemDesc}>{categoria.descripcion || "Sin descripción"}</Text>
                    </View>

                    <View style={styles.modalCategoriaActions}>
                      <TouchableOpacity
                        style={styles.modalCategoriaEditBtn}
                        onPress={() => editarCategoria(categoria)}
                        disabled={guardandoCategoria}
                      >
                        <Ionicons name="create-outline" size={14} color="#1d4ed8" />
                        <Text style={styles.modalCategoriaEditText}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalCategoriaDeleteBtn}
                        onPress={() => eliminarCategoria(categoria)}
                        disabled={guardandoCategoria}
                      >
                        <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                        <Text style={styles.modalCategoriaDeleteText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {mensajeModalCategoria ? <Text style={styles.modalError}>{mensajeModalCategoria}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={cerrarModalCategoria}
                disabled={guardandoCategoria}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={guardarCategoria}
                disabled={guardandoCategoria}
              >
                {guardandoCategoria ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>{categoriaEditandoId ? "Guardar cambios" : "Guardar"}</Text>
                )}
              </TouchableOpacity>
            </View>
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

  refreshIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center"
  },

  content: {
    paddingBottom: 110
  },

  body: {
    padding: 16
  },

  pageHeader: {
    marginBottom: 14
  },

  headerActions: {
    flexDirection: "row",
    gap: 8
  },

  btnNuevo: {
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },

  btnCategoria: {
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },

  btnNuevoText: {
    color: "white",
    fontWeight: "700",
    fontSize: 12
  },

  stats: {
    gap: 10,
    marginBottom: 14
  },

  statCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 2,
    borderColor: "transparent"
  },

  statCardActiva: {
    borderColor: "#2563eb"
  },

  statLabel: {
    fontSize: 13,
    color: "#64748b"
  },

  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    marginVertical: 4
  },

  statHintUp: {
    fontSize: 12,
    color: "#16a34a"
  },

  statHintDown: {
    fontSize: 12,
    color: "#dc2626"
  },

  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center"
  },

  statIconBlue: {
    backgroundColor: "#3b82f6"
  },

  statIconRed: {
    backgroundColor: "#dc2626"
  },

  filterCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2
  },

  search: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14
  },

  filterRow: {
    flexDirection: "row",
    gap: 8
  },

  filterPill: {
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },

  filterPillActiva: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb"
  },

  filterPillText: {
    fontSize: 12,
    color: "#475569"
  },

  filterPillTextActiva: {
    color: "white",
    fontWeight: "600"
  },

  emptyState: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    alignItems: "center",
    gap: 6,
    marginBottom: 12
  },

  emptyText: {
    color: "#64748b",
    fontSize: 13
  },

  emptyTextError: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center"
  },

  reintentar: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600"
  },

  productCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },

  image: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 10
  },

  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center"
  },

  productInfo: {
    flex: 1
  },

  productHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },

  code: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b"
  },

  estadoActivo: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },

  estadoText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534"
  },

  title: {
    fontWeight: "700",
    fontSize: 15,
    color: "#0f172a",
    marginTop: 5
  },

  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 6
  },

  categoryText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600"
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },

  price: {
    color: "#0f172a",
    fontWeight: "700"
  },

  stock: {
    color: "#1d4ed8",
    fontWeight: "600"
  },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },

  actionBtn: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },

  actionTextBlue: {
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 12
  },

  actionTextRed: {
    color: "#dc2626",
    fontWeight: "600",
    fontSize: 12
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    padding: 18
  },

  modalCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },

  modalLabel: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 6,
    fontWeight: "600"
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#f8fafc"
  },

  modalTextarea: {
    minHeight: 82,
    textAlignVertical: "top"
  },

  modalImageButton: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10
  },

  modalImageButtonText: {
    color: "#2563eb",
    fontWeight: "600"
  },

  modalPreviewImage: {
    width: 88,
    height: 88,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },

  modalCategoriasRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },

  modalCategoriaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff"
  },

  modalCategoriaBtnActiva: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb"
  },

  modalCategoriaText: {
    color: "#1e40af",
    fontSize: 12,
    fontWeight: "600"
  },

  modalCategoriaTextActiva: {
    color: "white"
  },

  modalGrid: {
    flexDirection: "row",
    gap: 8
  },

  modalFieldHalf: {
    flex: 1
  },

  modalHint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10
  },

  modalError: {
    fontSize: 12,
    color: "#dc2626",
    marginBottom: 10
  },

  modalActions: {
    flexDirection: "row",
    gap: 8
  },

  modalBtnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "white"
  },

  modalBtnCancelText: {
    color: "#334155",
    fontWeight: "600"
  },

  modalBtnSave: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#2563eb"
  },

  modalBtnSaveText: {
    color: "white",
    fontWeight: "700"
  },

  modalSubTitle: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a"
  },

  modalCategoriasList: {
    gap: 8,
    marginBottom: 10
  },

  modalCategoriasEmpty: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10
  },

  modalCategoriaItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc"
  },

  modalCategoriaItemInfo: {
    flex: 1,
    gap: 2
  },

  modalCategoriaItemTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a"
  },

  modalCategoriaItemDesc: {
    fontSize: 11,
    color: "#64748b"
  },

  modalCategoriaActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },

  modalCategoriaEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8
  },

  modalCategoriaEditText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1d4ed8"
  },

  modalCategoriaDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8
  },

  modalCategoriaDeleteText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b91c1c"
  }
});

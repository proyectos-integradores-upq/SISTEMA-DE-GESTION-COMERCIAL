<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\DatoFiscal;
use App\Models\DetalleVenta;
use App\Models\EstadoProducto;
use App\Models\MovimientoInventario;
use App\Models\Producto;
use App\Models\Venta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VentaController extends Controller
{
    private function getOrCreateEstadoId(string $nombre): int
    {
        $estado = EstadoProducto::whereRaw('LOWER(nombre) = ?', [strtolower($nombre)])->first();

        if (!$estado) {
            $estado = EstadoProducto::create(['nombre' => $nombre]);
        }

        return (int) $estado->id_estado;
    }

    private function syncEstadoProductoPorStock(int $idProducto): void
    {
        $producto = Producto::find($idProducto);
        if (!$producto) return;

        $targetEstadoId = (int) $producto->stock <= 0
            ? $this->getOrCreateEstadoId('Agotado')
            : $this->getOrCreateEstadoId('Activo');

        if ((int) $producto->id_estado !== $targetEstadoId) {
            $producto->id_estado = $targetEstadoId;
            $producto->save();
        }
    }

    private function construirDetalleFactura(int $idVenta, string $claveProducto, string $claveUnidad)
    {
        return DB::table('detalle_venta as dv')
            ->leftJoin('productos as p', 'p.id_producto', '=', 'dv.id_producto')
            ->where('dv.id_venta', $idVenta)
            ->select([
                'dv.id_producto',
                DB::raw('COALESCE(p.nombre, "Producto") as producto'),
                'dv.cantidad',
                'dv.precio_unitario',
                DB::raw('(dv.cantidad * dv.precio_unitario) as subtotal'),
            ])
            ->get()
            ->map(function ($item) use ($claveProducto, $claveUnidad) {
                $item->clave_producto = strtoupper(trim($claveProducto));
                $item->clave_unidad = strtoupper(trim($claveUnidad));
                return $item;
            });
    }

    public function index()
    {
        return DB::table('detalle_venta as dv')
            ->join('ventas as v', 'v.id_venta', '=', 'dv.id_venta')
            ->leftJoin('productos as p', 'p.id_producto', '=', 'dv.id_producto')
            ->leftJoin('clientes as c', 'c.id_cliente', '=', 'v.id_cliente')
            ->select([
                'v.id_venta',
                'dv.id_detalle',
                'v.fecha',
                'v.metodo_pago',
                'v.total',
                'v.id_cliente',
                'v.id_dato_fiscal',
                DB::raw('COALESCE(c.nombre, "Publico General") as cliente'),
                'dv.id_producto',
                DB::raw('COALESCE(p.nombre, "Producto eliminado") as producto'),
                'dv.cantidad',
                'dv.precio_unitario',
                'dv.precio_compra',
                DB::raw('CASE WHEN v.id_dato_fiscal IS NULL THEN 0 ELSE 1 END as esta_facturada'),
                DB::raw('(dv.cantidad * dv.precio_unitario) as subtotal'),
            ])
            ->orderByDesc('dv.id_detalle')
            ->limit(150)
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'metodo_pago' => 'required|string|max:50',
            'id_cliente' => 'nullable|integer|exists:clientes,id_cliente',
            'id_dato_fiscal' => 'nullable|integer|exists:datos_fiscales,id_dato_fiscal',
            'items' => 'required|array|min:1',
            'items.*.id_producto' => 'required|integer|exists:productos,id_producto',
            'items.*.cantidad' => 'required|integer|min:1',
            'items.*.precio_compra' => 'nullable|numeric|min:0',
        ]);

        $agrupados = [];
        foreach ($data['items'] as $item) {
            $idProducto = (int) $item['id_producto'];
            $cantidad = (int) $item['cantidad'];
            $precioCompra = isset($item['precio_compra']) ? (float) $item['precio_compra'] : null;

            if (!isset($agrupados[$idProducto])) {
                $agrupados[$idProducto] = [
                    'cantidad' => 0,
                    'precio_compra' => $precioCompra,
                ];
            }

            $agrupados[$idProducto]['cantidad'] += $cantidad;

            if ($precioCompra !== null) {
                $agrupados[$idProducto]['precio_compra'] = $precioCompra;
            }
        }

        $ids = array_map('intval', array_keys($agrupados));

        $productos = Producto::whereIn('id_producto', $ids)
            ->get()
            ->keyBy('id_producto');

        foreach ($agrupados as $idProducto => $item) {
            $producto = $productos->get((int) $idProducto);

            if (!$producto) {
                return response()->json([
                    'message' => 'Uno de los productos ya no existe.',
                    'id_producto' => (int) $idProducto,
                ], 422);
            }

            if ((int) $producto->stock < (int) $item['cantidad']) {
                return response()->json([
                    'message' => 'Stock insuficiente para completar la venta.',
                    'id_producto' => (int) $idProducto,
                    'stock_disponible' => (int) $producto->stock,
                ], 422);
            }
        }

        $itemsNormalizados = [];
        foreach ($agrupados as $idProducto => $item) {
            $producto = $productos->get((int) $idProducto);
            $precioUnitario = (float) $producto->precio;
            $cantidad = (int) $item['cantidad'];
            $subtotal = round($precioUnitario * $cantidad, 2);

            $itemsNormalizados[] = [
                'id_producto' => (int) $idProducto,
                'nombre' => (string) $producto->nombre,
                'cantidad' => $cantidad,
                'precio_unitario' => $precioUnitario,
                'precio_compra' => isset($item['precio_compra']) ? (float) $item['precio_compra'] : $precioUnitario,
                'subtotal' => $subtotal,
            ];
        }

        $subtotalVenta = round(array_sum(array_column($itemsNormalizados, 'subtotal')), 2);
        $iva = round($subtotalVenta * 0.16, 2);
        $totalVenta = round($subtotalVenta + $iva, 2);

        $resultado = DB::transaction(function () use ($data, $itemsNormalizados, $totalVenta) {
            $venta = Venta::create([
                'total' => $totalVenta,
                'metodo_pago' => $data['metodo_pago'],
                'id_cliente' => $data['id_cliente'] ?? null,
                'id_dato_fiscal' => $data['id_dato_fiscal'] ?? null,
            ]);

            foreach ($itemsNormalizados as $item) {
                DetalleVenta::create([
                    'id_venta' => $venta->id_venta,
                    'id_producto' => $item['id_producto'],
                    'cantidad' => $item['cantidad'],
                    'precio_unitario' => $item['precio_unitario'],
                    'precio_compra' => $item['precio_compra'],
                ]);

                Producto::where('id_producto', $item['id_producto'])->decrement('stock', $item['cantidad']);
                $this->syncEstadoProductoPorStock((int) $item['id_producto']);

                MovimientoInventario::create([
                    'id_producto' => $item['id_producto'],
                    'cantidad' => $item['cantidad'],
                    'tipo' => 'Salida',
                    'referencia' => 'Venta #' . $venta->id_venta,
                ]);
            }

            return $venta;
        });

        return response()->json([
            'message' => 'Venta registrada correctamente.',
            'id_venta' => $resultado->id_venta,
            'metodo_pago' => $data['metodo_pago'],
            'subtotal' => $subtotalVenta,
            'iva' => $iva,
            'total' => $totalVenta,
            'items' => $itemsNormalizados,
        ], 201);
    }

    public function facturar(Request $request, int $id)
    {
        $venta = Venta::findOrFail($id);

        if (!empty($venta->id_dato_fiscal)) {
            return response()->json([
                'message' => 'La venta ya fue facturada previamente.',
                'id_venta' => $venta->id_venta,
                'id_dato_fiscal' => $venta->id_dato_fiscal,
            ], 409);
        }

        $data = $request->validate([
            'nombre_cliente' => 'required|string|max:150',
            'telefono' => 'nullable|string|max:20',
            'correo' => 'nullable|email|max:100',
            'rfc' => 'required|string|max:20',
            'razon_social' => 'required|string|max:150',
            'uso_cfdi' => 'required|string|max:50',
            'emisor_nombre' => 'required|string|max:150',
            'emisor_rfc' => 'required|string|max:20',
            'emisor_codigo_postal' => 'required|string|max:10',
            'emisor_regimen_fiscal' => 'required|string|max:120',
            'forma_pago' => 'required|string|max:50',
            'metodo_pago_cfdi' => 'required|string|max:50',
            'moneda' => 'required|string|size:3',
            'lugar_expedicion' => 'required|string|max:120',
            'clave_producto' => 'required|string|max:20',
            'clave_unidad' => 'required|string|max:20',
        ]);

        $resultado = DB::transaction(function () use ($venta, $data) {
            $cliente = Cliente::create([
                'nombre' => $data['nombre_cliente'],
                'telefono' => $data['telefono'] ?? null,
                'correo' => $data['correo'] ?? null,
            ]);

            $datoFiscal = DatoFiscal::create([
                'id_cliente' => $cliente->id_cliente,
                'rfc' => strtoupper(trim($data['rfc'])),
                'razon_social' => $data['razon_social'],
                'uso_cfdi' => strtoupper(trim($data['uso_cfdi'])),
            ]);

            $venta->id_cliente = $cliente->id_cliente;
            $venta->id_dato_fiscal = $datoFiscal->id_dato_fiscal;
            $venta->save();

            return [
                'cliente' => $cliente,
                'dato_fiscal' => $datoFiscal,
            ];
        });

        $detalles = $this->construirDetalleFactura(
            (int) $venta->id_venta,
            (string) $data['clave_producto'],
            (string) $data['clave_unidad']
        );

        return response()->json([
            'message' => 'Facturacion generada correctamente.',
            'folio' => 'FAC-' . str_pad((string) $venta->id_venta, 6, '0', STR_PAD_LEFT),
            'id_venta' => $venta->id_venta,
            'fecha' => $venta->fecha,
            'metodo_pago' => $venta->metodo_pago,
            'total' => (float) $venta->total,
            'cliente' => [
                'id_cliente' => $resultado['cliente']->id_cliente,
                'nombre' => $resultado['cliente']->nombre,
                'correo' => $resultado['cliente']->correo,
                'telefono' => $resultado['cliente']->telefono,
            ],
            'datos_fiscales' => [
                'id_dato_fiscal' => $resultado['dato_fiscal']->id_dato_fiscal,
                'rfc' => $resultado['dato_fiscal']->rfc,
                'razon_social' => $resultado['dato_fiscal']->razon_social,
                'uso_cfdi' => $resultado['dato_fiscal']->uso_cfdi,
            ],
            'emisor' => [
                'nombre' => $data['emisor_nombre'],
                'rfc' => strtoupper(trim($data['emisor_rfc'])),
                'codigo_postal' => trim($data['emisor_codigo_postal']),
                'regimen_fiscal' => $data['emisor_regimen_fiscal'],
            ],
            'comprobante' => [
                'forma_pago' => $data['forma_pago'],
                'metodo_pago' => $data['metodo_pago_cfdi'],
                'moneda' => strtoupper(trim($data['moneda'])),
                'lugar_expedicion' => $data['lugar_expedicion'],
            ],
            'detalle' => $detalles,
        ], 201);
    }

    public function factura(int $id)
    {
        $venta = Venta::findOrFail($id);

        if (empty($venta->id_dato_fiscal)) {
            return response()->json([
                'message' => 'La venta seleccionada todavia no esta facturada.',
                'id_venta' => $venta->id_venta,
            ], 409);
        }

        $cliente = Cliente::find($venta->id_cliente);
        $datoFiscal = DatoFiscal::find($venta->id_dato_fiscal);

        if (!$datoFiscal) {
            return response()->json([
                'message' => 'No se encontraron datos fiscales para esta venta.',
                'id_venta' => $venta->id_venta,
            ], 404);
        }

        $metodoPagoTexto = strtolower(trim((string) $venta->metodo_pago));
        $formaPago = '99 Por definir';

        if ($metodoPagoTexto === 'efectivo') {
            $formaPago = '01 Efectivo';
        } elseif ($metodoPagoTexto === 'tarjeta') {
            $formaPago = '04 Tarjeta de credito';
        } elseif ($metodoPagoTexto === 'transferencia') {
            $formaPago = '03 Transferencia electronica';
        }

        $detalles = $this->construirDetalleFactura((int) $venta->id_venta, '01010101', 'H87');

        return response()->json([
            'message' => 'Factura recuperada correctamente.',
            'folio' => 'FAC-' . str_pad((string) $venta->id_venta, 6, '0', STR_PAD_LEFT),
            'id_venta' => $venta->id_venta,
            'fecha' => $venta->fecha,
            'metodo_pago' => $venta->metodo_pago,
            'total' => (float) $venta->total,
            'cliente' => [
                'id_cliente' => $cliente?->id_cliente,
                'nombre' => $cliente?->nombre ?? 'Publico General',
                'correo' => $cliente?->correo,
                'telefono' => $cliente?->telefono,
            ],
            'datos_fiscales' => [
                'id_dato_fiscal' => $datoFiscal->id_dato_fiscal,
                'rfc' => $datoFiscal->rfc,
                'razon_social' => $datoFiscal->razon_social,
                'uso_cfdi' => $datoFiscal->uso_cfdi,
            ],
            'emisor' => [
                'nombre' => 'VentaTotal SA de CV',
                'rfc' => 'AAA010101AAA',
                'codigo_postal' => '64000',
                'regimen_fiscal' => '601 General de Ley Personas Morales',
            ],
            'comprobante' => [
                'forma_pago' => $formaPago,
                'metodo_pago' => 'PUE Pago en una sola exhibicion',
                'moneda' => 'MXN',
                'lugar_expedicion' => 'Monterrey, Nuevo Leon',
            ],
            'detalle' => $detalles,
        ], 200);
    }

    public function detalle(int $id)
    {
        $venta = Venta::findOrFail($id);

        $cliente = Cliente::find($venta->id_cliente);

        $detalles = DB::table('detalle_venta as dv')
            ->leftJoin('productos as p', 'p.id_producto', '=', 'dv.id_producto')
            ->where('dv.id_venta', $venta->id_venta)
            ->select([
                'dv.id_detalle',
                'dv.id_producto',
                DB::raw('COALESCE(p.nombre, "Producto") as producto'),
                'dv.cantidad',
                'dv.precio_unitario',
                'dv.precio_compra',
                DB::raw('(dv.cantidad * dv.precio_unitario) as subtotal'),
            ])
            ->orderBy('dv.id_detalle')
            ->get();

        return response()->json([
            'id_venta' => $venta->id_venta,
            'fecha' => $venta->fecha,
            'metodo_pago' => $venta->metodo_pago,
            'cliente' => $cliente?->nombre ?? 'Publico General',
            'total' => (float) $venta->total,
            'items' => $detalles,
        ], 200);
    }
}

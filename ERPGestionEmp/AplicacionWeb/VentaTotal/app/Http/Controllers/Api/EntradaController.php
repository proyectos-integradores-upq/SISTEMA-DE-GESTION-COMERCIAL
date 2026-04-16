<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Compra;
use App\Models\DetalleCompra;
use App\Models\EstadoProducto;
use App\Models\MovimientoInventario;
use App\Models\Producto;
use App\Models\ProveedorProductoMap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EntradaController extends Controller
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

    private function resolverRelacion(int $idProveedor, int $idProducto)
    {
        $relacion = DB::table('proveedor_producto_map as ppm')
            ->join('productos_proveedor as pp', 'pp.id_producto_proveedor', '=', 'ppm.id_producto_proveedor')
            ->join('productos as pr', 'pr.id_producto', '=', 'ppm.id_producto')
            ->join('proveedores as pv', 'pv.id_proveedor', '=', 'pp.id_proveedor')
            ->where('pp.id_proveedor', $idProveedor)
            ->where('ppm.id_producto', $idProducto)
            ->select([
                'pp.id_producto_proveedor',
                'pp.precio_compra',
                'pr.id_producto',
                'pr.nombre as producto_nombre',
                'pr.stock as stock_actual',
                'pv.id_proveedor',
                'pv.nombre as proveedor_nombre',
                'pv.empresa as proveedor_empresa',
            ])
            ->first();

        if ($relacion) {
            return $relacion;
        }

        $relacion = DB::table('productos_proveedor as pp')
            ->join('productos as pr', 'pr.nombre', '=', 'pp.nombre')
            ->join('proveedores as pv', 'pv.id_proveedor', '=', 'pp.id_proveedor')
            ->where('pp.id_proveedor', $idProveedor)
            ->where('pr.id_producto', $idProducto)
            ->select([
                'pp.id_producto_proveedor',
                'pp.precio_compra',
                'pr.id_producto',
                'pr.nombre as producto_nombre',
                'pr.stock as stock_actual',
                'pv.id_proveedor',
                'pv.nombre as proveedor_nombre',
                'pv.empresa as proveedor_empresa',
            ])
            ->first();

        if ($relacion) {
            ProveedorProductoMap::firstOrCreate([
                'id_producto_proveedor' => $relacion->id_producto_proveedor,
                'id_producto' => $relacion->id_producto,
            ]);
        }

        return $relacion;
    }

    public function index()
    {
        return DB::table('detalle_compra as dc')
            ->join('compras as c', 'c.id_compra', '=', 'dc.id_compra')
            ->join('proveedores as p', 'p.id_proveedor', '=', 'c.id_proveedor')
            ->join('productos_proveedor as pp', 'pp.id_producto_proveedor', '=', 'dc.id_producto_proveedor')
            ->leftJoin('proveedor_producto_map as ppm', 'ppm.id_producto_proveedor', '=', 'pp.id_producto_proveedor')
            ->leftJoin('productos as pr', 'pr.id_producto', '=', 'ppm.id_producto')
            ->leftJoin('movimientos_inventario as mi', function ($join) {
                $join->on('mi.id_producto', '=', 'pr.id_producto')
                    ->where('mi.tipo', '=', 'Entrada')
                    ->whereRaw("mi.referencia like concat('Compra #', c.id_compra, '%')");
            })
            ->select([
                'c.id_compra',
                'dc.id_detalle',
                'c.id_proveedor',
                'p.nombre as proveedor_nombre',
                'p.empresa as proveedor_empresa',
                'c.fecha',
                'c.total',
                'dc.cantidad',
                'dc.precio_unitario as precio_compra',
                DB::raw('COALESCE(pr.id_producto, ppm.id_producto) as id_producto'),
                DB::raw('COALESCE(pr.nombre, pp.nombre) as producto'),
                DB::raw('"Admin" as usuario'),
                DB::raw("CASE WHEN mi.referencia IS NULL THEN '-' WHEN INSTR(mi.referencia, ' - ') > 0 THEN SUBSTRING_INDEX(mi.referencia, ' - ', -1) ELSE '-' END as observacion"),
            ])
            ->orderByDesc('dc.id_detalle')
            ->limit(100)
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'id_proveedor' => 'required|integer|exists:proveedores,id_proveedor',
            'id_producto' => 'nullable|integer|exists:productos,id_producto',
            'cantidad' => 'nullable|integer|min:1',
            'items' => 'nullable|array|min:1',
            'items.*.id_producto' => 'required_with:items|integer|exists:productos,id_producto',
            'items.*.cantidad' => 'required_with:items|integer|min:1',
            'observacion' => 'nullable|string|max:500',
        ]);

        $items = [];

        if (!empty($data['items']) && is_array($data['items'])) {
            $items = array_map(static function ($item) {
                return [
                    'id_producto' => (int) $item['id_producto'],
                    'cantidad' => (int) $item['cantidad'],
                ];
            }, $data['items']);
        } elseif (!empty($data['id_producto']) && !empty($data['cantidad'])) {
            $items = [[
                'id_producto' => (int) $data['id_producto'],
                'cantidad' => (int) $data['cantidad'],
            ]];
        }

        if (empty($items)) {
            return response()->json([
                'message' => 'Debes enviar al menos un producto para la entrada.',
            ], 422);
        }

        $agrupados = [];
        foreach ($items as $item) {
            $idProducto = (int) $item['id_producto'];
            $cantidad = (int) $item['cantidad'];
            $agrupados[$idProducto] = ($agrupados[$idProducto] ?? 0) + $cantidad;
        }

        $itemsNormalizados = [];
        foreach ($agrupados as $idProducto => $cantidadTotal) {
            $relacion = $this->resolverRelacion((int) $data['id_proveedor'], (int) $idProducto);

            if (!$relacion) {
                return response()->json([
                    'message' => 'El producto seleccionado no esta asignado al proveedor.',
                    'id_producto' => (int) $idProducto,
                ], 422);
            }

            $precioCompra = (float) $relacion->precio_compra;
            $subtotal = round($precioCompra * $cantidadTotal, 2);

            $itemsNormalizados[] = [
                'id_producto' => (int) $relacion->id_producto,
                'id_producto_proveedor' => (int) $relacion->id_producto_proveedor,
                'producto' => (string) $relacion->producto_nombre,
                'precio_compra' => $precioCompra,
                'cantidad' => (int) $cantidadTotal,
                'subtotal' => $subtotal,
                'proveedor_nombre' => (string) $relacion->proveedor_nombre,
                'proveedor_empresa' => $relacion->proveedor_empresa,
            ];
        }

        $total = round(array_sum(array_column($itemsNormalizados, 'subtotal')), 2);

        $resultado = DB::transaction(function () use ($data, $itemsNormalizados, $total) {
            $compra = Compra::create([
                'id_proveedor' => $data['id_proveedor'],
                'total' => $total,
            ]);

            $detalles = [];
            $movimientos = [];

            foreach ($itemsNormalizados as $item) {
                $detalle = DetalleCompra::create([
                    'id_compra' => $compra->id_compra,
                    'id_producto_proveedor' => $item['id_producto_proveedor'],
                    'cantidad' => $item['cantidad'],
                    'precio_unitario' => $item['precio_compra'],
                ]);

                $referencia = 'Compra #' . $compra->id_compra;
                if (!empty($data['observacion'])) {
                    $referencia .= ' - ' . $data['observacion'];
                }

                MovimientoInventario::create([
                    'id_producto' => $item['id_producto'],
                    'cantidad' => $item['cantidad'],
                    'tipo' => 'Entrada',
                    'referencia' => $referencia,
                ]);

                Producto::where('id_producto', $item['id_producto'])->increment('stock', $item['cantidad']);
                $this->syncEstadoProductoPorStock((int) $item['id_producto']);

                $detalles[] = $detalle;
                $movimientos[] = $item;
            }

            return [
                'compra' => $compra,
                'detalles' => $detalles,
                'items' => $movimientos,
            ];
        });

        $compra = Compra::findOrFail($resultado['compra']->id_compra);

        $itemsRespuesta = [];
        foreach ($resultado['items'] as $item) {
            $productoActualizado = Producto::findOrFail($item['id_producto']);
            $itemsRespuesta[] = [
                'id_producto' => $item['id_producto'],
                'producto' => $item['producto'],
                'cantidad' => $item['cantidad'],
                'precio_compra' => $item['precio_compra'],
                'subtotal' => $item['subtotal'],
                'stock_nuevo' => (int) $productoActualizado->stock,
            ];
        }

        $primerItem = $itemsRespuesta[0];
        $primeraRelacion = $itemsNormalizados[0];

        return response()->json([
            'id_compra' => $compra->id_compra,
            'id_detalle' => $resultado['detalles'][0]->id_detalle,
            'fecha' => $compra->fecha,
            'id_proveedor' => (int) $data['id_proveedor'],
            'proveedor' => trim($primeraRelacion['proveedor_nombre'] . ' - ' . ($primeraRelacion['proveedor_empresa'] ?? '')),
            'id_producto' => $primerItem['id_producto'],
            'producto' => $primerItem['producto'],
            'cantidad' => $primerItem['cantidad'],
            'precio_compra' => $primerItem['precio_compra'],
            'total' => $total,
            'stock_nuevo' => $primerItem['stock_nuevo'],
            'observacion' => $data['observacion'] ?? null,
            'items' => $itemsRespuesta,
        ], 201);
    }
}

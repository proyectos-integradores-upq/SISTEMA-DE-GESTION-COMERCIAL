<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\ProductoProveedor;
use App\Models\Proveedor;
use App\Models\ProveedorProductoMap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProveedorController extends Controller
{
    private function backfillMapByNombre(int $idProveedor): void
    {
        $tieneMapeo = DB::table('proveedor_producto_map as ppm')
            ->join('productos_proveedor as pp', 'pp.id_producto_proveedor', '=', 'ppm.id_producto_proveedor')
            ->where('pp.id_proveedor', $idProveedor)
            ->exists();

        if ($tieneMapeo) {
            return;
        }

        $pendientes = DB::table('productos_proveedor as pp')
            ->leftJoin('proveedor_producto_map as ppm', 'ppm.id_producto_proveedor', '=', 'pp.id_producto_proveedor')
            ->where('pp.id_proveedor', $idProveedor)
            ->whereNull('ppm.id_map')
            ->select(['pp.id_producto_proveedor', 'pp.nombre'])
            ->get();

        foreach ($pendientes as $item) {
            $producto = Producto::where('nombre', $item->nombre)->first();

            if (!$producto) {
                continue;
            }

            ProveedorProductoMap::firstOrCreate([
                'id_producto_proveedor' => $item->id_producto_proveedor,
                'id_producto' => $producto->id_producto,
            ]);
        }
    }

    public function index()
    {
        return Proveedor::withCount('productosProveedor')
            ->orderByDesc('id_proveedor')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:150',
            'empresa' => 'nullable|string|max:150',
            'telefono' => 'nullable|string|max:20',
            'correo' => 'nullable|email|max:100',
            'direccion' => 'nullable|string',
            'rfc' => 'nullable|string|max:20',
            'estado' => 'nullable|string|in:Activo,Inactivo,activo,inactivo',
        ]);

        if (!array_key_exists('estado', $data) || empty($data['estado'])) {
            $data['estado'] = 'Activo';
        } else {
            $data['estado'] = strtolower((string) $data['estado']) === 'inactivo' ? 'Inactivo' : 'Activo';
        }

        $proveedor = Proveedor::create($data);

        return response()->json($proveedor, 201);
    }

    public function update(Request $request, $id)
    {
        $proveedor = Proveedor::findOrFail($id);

        $data = $request->validate([
            'nombre' => 'sometimes|required|string|max:150',
            'empresa' => 'sometimes|nullable|string|max:150',
            'telefono' => 'sometimes|nullable|string|max:20',
            'correo' => 'sometimes|nullable|email|max:100',
            'direccion' => 'sometimes|nullable|string',
            'rfc' => 'sometimes|nullable|string|max:20',
            'estado' => 'sometimes|nullable|string|in:Activo,Inactivo,activo,inactivo',
        ]);

        if (array_key_exists('estado', $data) && !empty($data['estado'])) {
            $data['estado'] = strtolower((string) $data['estado']) === 'inactivo' ? 'Inactivo' : 'Activo';
        }

        $proveedor->update($data);

        return $proveedor->fresh();
    }

    public function destroy($id)
    {
        $proveedor = Proveedor::findOrFail($id);

        if (strtolower((string) $proveedor->estado) !== 'inactivo') {
            $proveedor->estado = 'Inactivo';
            $proveedor->save();
        }

        return response()->json([
            'message' => 'El proveedor no se elimina fisicamente. Se cambio a Inactivo.',
            'deleted' => false,
            'deactivated' => true,
        ], 200);
    }

    public function productos($id)
    {
        Proveedor::findOrFail($id);
        $this->backfillMapByNombre((int) $id);

        return DB::table('proveedor_producto_map as ppm')
            ->join('productos_proveedor as pp', 'pp.id_producto_proveedor', '=', 'ppm.id_producto_proveedor')
            ->join('productos as p', 'p.id_producto', '=', 'ppm.id_producto')
            ->where('pp.id_proveedor', $id)
            ->select([
                'pp.id_producto_proveedor',
                'pp.id_proveedor',
                'pp.nombre',
                'pp.descripcion',
                'pp.precio_compra',
                'p.id_producto',
            ])
            ->orderBy('pp.nombre')
            ->get();
    }

    public function syncProductos(Request $request, $id)
    {
        $proveedor = Proveedor::findOrFail($id);

        $data = $request->validate([
            'productos' => 'required|array|min:1',
            'productos.*.id_producto' => 'required|integer|exists:productos,id_producto',
            'productos.*.precio_compra' => 'required|numeric|min:0',
        ]);

        $idsProducto = collect($data['productos'])
            ->pluck('id_producto')
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        if ($idsProducto->count() !== count($data['productos'])) {
            return response()->json([
                'message' => 'No se permiten productos repetidos para un proveedor.',
            ], 422);
        }

        $catalogo = Producto::whereIn('id_producto', $idsProducto)->get()->keyBy('id_producto');

        if ($catalogo->count() !== $idsProducto->count()) {
            return response()->json([
                'message' => 'Uno o mas productos no existen en el catalogo.',
            ], 422);
        }

        DB::transaction(function () use ($proveedor, $catalogo, $data, $idsProducto) {
            $tieneTablaDetalleCompra = Schema::hasTable('detalle_compra');

            $mapeosActuales = DB::table('proveedor_producto_map as ppm')
                ->join('productos_proveedor as pp', 'pp.id_producto_proveedor', '=', 'ppm.id_producto_proveedor')
                ->where('pp.id_proveedor', $proveedor->id_proveedor)
                ->select(['ppm.id_map', 'ppm.id_producto', 'ppm.id_producto_proveedor'])
                ->get();

            $mapeoPorProducto = $mapeosActuales->keyBy(fn ($row) => (int) $row->id_producto);

            foreach ($data['productos'] as $item) {
                $idProducto = (int) $item['id_producto'];
                $precioCompra = (float) $item['precio_compra'];
                $productoCatalogo = $catalogo->get($idProducto);
                $mapeo = $mapeoPorProducto->get($idProducto);

                if ($mapeo) {
                    ProductoProveedor::where('id_producto_proveedor', $mapeo->id_producto_proveedor)
                        ->update([
                            'precio_compra' => $precioCompra,
                            'nombre' => $productoCatalogo->nombre,
                            'descripcion' => $productoCatalogo->descripcion,
                        ]);
                    continue;
                }

                $productoProveedor = ProductoProveedor::create([
                    'id_proveedor' => $proveedor->id_proveedor,
                    'nombre' => $productoCatalogo->nombre,
                    'descripcion' => $productoCatalogo->descripcion,
                    'precio_compra' => $precioCompra,
                ]);

                ProveedorProductoMap::create([
                    'id_producto_proveedor' => $productoProveedor->id_producto_proveedor,
                    'id_producto' => $idProducto,
                ]);
            }

            $aRemover = $mapeosActuales->filter(
                fn ($row) => !$idsProducto->contains((int) $row->id_producto)
            );

            foreach ($aRemover as $mapeo) {
                $idProductoProveedor = (int) $mapeo->id_producto_proveedor;

                ProveedorProductoMap::where('id_map', (int) $mapeo->id_map)->delete();

                $tieneHistorial = $tieneTablaDetalleCompra
                    ? DB::table('detalle_compra')
                        ->where('id_producto_proveedor', $idProductoProveedor)
                        ->exists()
                    : false;

                if (!$tieneHistorial) {
                    ProductoProveedor::where('id_producto_proveedor', $idProductoProveedor)->delete();
                }
            }
        });

        return response()->json([
            'message' => 'Productos del proveedor actualizados correctamente.',
        ], 200);
    }
}

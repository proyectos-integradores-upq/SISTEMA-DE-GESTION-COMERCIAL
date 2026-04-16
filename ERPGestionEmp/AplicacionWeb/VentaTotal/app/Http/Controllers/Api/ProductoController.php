<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use App\Models\EstadoProducto;
use App\Models\Producto;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductoController extends Controller
{
    private function getOrCreateEstadoId(string $nombre): int
    {
        $estado = EstadoProducto::whereRaw('LOWER(nombre) = ?', [strtolower($nombre)])
            ->first();

        if (!$estado) {
            $estado = EstadoProducto::create(['nombre' => $nombre]);
        }

        return (int) $estado->id_estado;
    }

    private function getOrCreateEstadoActivoId(): int
    {
        return $this->getOrCreateEstadoId('Activo');
    }

    private function getOrCreateEstadoAgotadoId(): int
    {
        return $this->getOrCreateEstadoId('Agotado');
    }

    private function syncEstadoPorStock(Producto $producto): void
    {
        $targetEstadoId = (int) $producto->stock <= 0
            ? $this->getOrCreateEstadoAgotadoId()
            : $this->getOrCreateEstadoActivoId();

        if ((int) $producto->id_estado !== $targetEstadoId) {
            $producto->id_estado = $targetEstadoId;
            $producto->save();
        }
    }

    private function generarSiguienteCodigo(): string
    {
        $maxNumero = 0;
        $codigos = Producto::where('codigo', 'like', 'PROD%')->pluck('codigo');

        foreach ($codigos as $codigo) {
            if (preg_match('/^PROD(\d+)$/', $codigo, $matches)) {
                $numero = (int) $matches[1];

                if ($numero > $maxNumero) {
                    $maxNumero = $numero;
                }
            }
        }

        $siguiente = $maxNumero + 1;

        return 'PROD' . str_pad((string) $siguiente, 3, '0', STR_PAD_LEFT);
    }

    public function index()
    {
        $productos = Producto::with(['categoria', 'estado'])
            ->orderByDesc('id_producto')
            ->get();

        $productos->each(function ($producto) {
            $this->syncEstadoPorStock($producto);
            $producto->loadMissing(['categoria', 'estado']);
        });

        return $productos;
    }

    public function categorias()
    {
        return Categoria::orderBy('nombre')->get();
    }

    public function storeCategoria(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:100|unique:categorias,nombre',
            'descripcion' => 'nullable|string',
        ]);

        $categoria = Categoria::create($data);

        return response()->json($categoria, 201);
    }

    public function updateCategoria(Request $request, $id)
    {
        $categoria = Categoria::findOrFail($id);

        $data = $request->validate([
            'nombre' => 'required|string|max:100|unique:categorias,nombre,' . $categoria->id_categoria . ',id_categoria',
            'descripcion' => 'nullable|string',
        ]);

        $categoria->update($data);

        return response()->json($categoria->fresh(), 200);
    }

    public function destroyCategoria($id)
    {
        $categoria = Categoria::findOrFail($id);

        $tieneProductos = Producto::where('id_categoria', $categoria->id_categoria)->exists();

        if ($tieneProductos) {
            return response()->json([
                'message' => 'No se puede eliminar la categoria porque tiene productos asociados.',
            ], 409);
        }

        $categoria->delete();

        return response()->json([
            'message' => 'Categoria eliminada correctamente.',
        ], 200);
    }

    public function estados()
    {
        $this->getOrCreateEstadoActivoId();
        $this->getOrCreateEstadoAgotadoId();

        return EstadoProducto::orderBy('id_estado')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'precio' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'id_categoria' => 'nullable|exists:categorias,id_categoria',
            'imagen' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $data['codigo'] = $this->generarSiguienteCodigo();
        $data['id_estado'] = (int) ($data['stock'] ?? 0) <= 0
            ? $this->getOrCreateEstadoAgotadoId()
            : $this->getOrCreateEstadoActivoId();

        if ($request->hasFile('imagen')) {
            $data['imagen'] = $request->file('imagen')->store('productos', 'public');
        }

        $producto = Producto::create($data);
        $this->syncEstadoPorStock($producto);

        return response()->json($producto->load(['categoria', 'estado']), 201);
    }

    public function show($id)
    {
        return Producto::with(['categoria', 'estado'])->findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $producto = Producto::findOrFail($id);

        $data = $request->validate([
            'nombre' => 'sometimes|required|string|max:150',
            'descripcion' => 'nullable|string',
            'precio' => 'sometimes|required|numeric|min:0',
            'stock' => 'sometimes|required|integer|min:0',
            'id_categoria' => 'sometimes|nullable|exists:categorias,id_categoria',
            'imagen' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        if ($request->hasFile('imagen')) {
            if (!empty($producto->imagen) && Storage::disk('public')->exists($producto->imagen)) {
                Storage::disk('public')->delete($producto->imagen);
            }

            $data['imagen'] = $request->file('imagen')->store('productos', 'public');
        }

        $producto->update($data);
        $this->syncEstadoPorStock($producto);

        return $producto->fresh()->load(['categoria', 'estado']);
    }

    public function destroy($id)
    {
        try {
            $producto = Producto::findOrFail($id);

            if (!empty($producto->imagen) && Storage::disk('public')->exists($producto->imagen)) {
                Storage::disk('public')->delete($producto->imagen);
            }

            $producto->delete();

            return response()->json([
                'message' => 'Producto eliminado correctamente',
            ], 200);
        } catch (QueryException $e) {
            return response()->json([
                'message' => 'No se puede eliminar el producto porque tiene registros relacionados.',
            ], 409);
        }
    }
}

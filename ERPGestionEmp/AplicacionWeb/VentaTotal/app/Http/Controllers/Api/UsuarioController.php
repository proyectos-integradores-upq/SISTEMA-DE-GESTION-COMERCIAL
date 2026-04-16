<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Database\QueryException;
use App\Models\Usuarios;

class UsuarioController extends Controller
{
    // 🔹 Obtener todos
    public function index()
    {
        return Usuarios::with(['rol'])
            ->orderByDesc('id_usuario')
            ->get();
    }

    // 🔹 Crear usuario
    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:100',
            'telefono' => 'nullable|string|max:20',
            'correo' => 'required|email|unique:usuarios,correo',
            'contrasena' => 'required|string|min:6',
            'id_rol' => 'nullable|exists:roles,id',
        ]);

        if (!array_key_exists('telefono', $data) || $data['telefono'] === null) {
            $data['telefono'] = '';
        }

        if (!array_key_exists('id_rol', $data) || empty($data['id_rol'])) {
            $data['id_rol'] = 1;
        }

        $data['contrasena'] = Hash::make($data['contrasena']);

        $usuario = Usuarios::create($data);

        return response()->json($usuario->load('rol'), 201);
    }

    // 🔹 Mostrar uno
    public function show($id)
    {
        $usuario = Usuarios::with('rol')->findOrFail($id);
        return $usuario;
    }

    // 🔹 Actualizar
    public function update(Request $request, $id)
    {
        $usuario = Usuarios::findOrFail($id);

        $data = $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
            'telefono' => 'nullable|string|max:20',
            'correo' => 'sometimes|required|email|unique:usuarios,correo,' . $id . ',id_usuario',
            'contrasena' => 'nullable|string|min:6',
            'id_rol' => 'sometimes|nullable|exists:roles,id'
        ]);

        if (array_key_exists('telefono', $data) && $data['telefono'] === null) {
            $data['telefono'] = '';
        }

        if (array_key_exists('id_rol', $data) && empty($data['id_rol'])) {
            unset($data['id_rol']);
        }

        if (isset($data['contrasena'])) {
            $data['contrasena'] = Hash::make($data['contrasena']);
        } else {
            unset($data['contrasena']);
        }

        $usuario->update($data);

        return $usuario->fresh()->load('rol');
    }

    // 🔹 Eliminar
    public function destroy($id)
    {
        try {
            $usuario = Usuarios::findOrFail($id);
            $usuario->delete();

            return response()->json([
                'message' => 'Usuario eliminado correctamente'
            ], 200);

        } catch (QueryException $e) {
            return response()->json([
                'message' => 'No se puede eliminar el usuario porque tiene registros relacionados.'
            ], 409);
        }
    }
}
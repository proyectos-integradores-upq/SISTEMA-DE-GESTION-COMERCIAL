<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Models\Usuarios;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:100',
            'apellido' => 'required|string|max:100',
            'correo' => 'required|email|unique:usuarios,correo',
            'contrasena' => 'required|string|min:6',
        ]);

        $usuario = Usuarios::create([
            'nombre' => $data['nombre'] . ' ' . $data['apellido'],
            'correo' => $data['correo'],
            'contrasena' => Hash::make($data['contrasena']),
            'id_rol' => 1,
            'telefono' => ''
        ]);

        $token = $usuario->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'usuario' => [
                'id_usuario' => $usuario->id_usuario,
                'nombre' => $usuario->nombre,
                'correo' => $usuario->correo
            ]
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'correo' => 'required|email',
            'contrasena' => 'required|string',
        ]);

        $user = Usuarios::where('correo', $data['correo'])->first();

        if (!$user || !Hash::check($data['contrasena'], $user->contrasena)) {
            throw ValidationException::withMessages([
                'correo' => ['Credenciales incorrectas']
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'usuario' => [
                'id_usuario' => $user->id_usuario,
                'nombre' => $user->nombre,
                'correo' => $user->correo
            ]
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}
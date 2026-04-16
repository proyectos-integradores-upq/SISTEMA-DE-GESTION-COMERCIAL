<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Proveedor extends Model
{
    protected $table = 'proveedores';
    protected $primaryKey = 'id_proveedor';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'empresa',
        'telefono',
        'correo',
        'direccion',
        'rfc',
        'estado',
    ];

    public function productosProveedor()
    {
        return $this->hasMany(ProductoProveedor::class, 'id_proveedor', 'id_proveedor');
    }
}

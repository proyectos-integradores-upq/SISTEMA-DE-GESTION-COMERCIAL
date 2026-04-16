<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductoProveedor extends Model
{
    protected $table = 'productos_proveedor';
    protected $primaryKey = 'id_producto_proveedor';
    public $timestamps = false;

    protected $fillable = [
        'id_proveedor',
        'nombre',
        'descripcion',
        'precio_compra',
    ];
}

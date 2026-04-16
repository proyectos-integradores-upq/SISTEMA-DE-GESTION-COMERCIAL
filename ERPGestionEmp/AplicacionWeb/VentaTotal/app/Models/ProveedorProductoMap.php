<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProveedorProductoMap extends Model
{
    protected $table = 'proveedor_producto_map';
    protected $primaryKey = 'id_map';
    public $timestamps = false;

    protected $fillable = [
        'id_producto_proveedor',
        'id_producto',
    ];
}

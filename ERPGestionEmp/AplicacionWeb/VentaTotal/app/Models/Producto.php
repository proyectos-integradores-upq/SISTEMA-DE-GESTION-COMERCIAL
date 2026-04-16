<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Producto extends Model
{
    protected $table = 'productos';
    protected $primaryKey = 'id_producto';
    public $timestamps = false;

    protected $fillable = [
        'codigo',
        'nombre',
        'descripcion',
        'precio',
        'stock',
        'imagen',
        'id_categoria',
        'id_estado',
    ];

    protected $appends = [
        'imagen_url',
    ];

    public function getImagenUrlAttribute()
    {
        if (empty($this->imagen)) {
            return null;
        }

        return Storage::disk('public')->url($this->imagen);
    }

    public function categoria()
    {
        return $this->belongsTo(Categoria::class, 'id_categoria', 'id_categoria');
    }

    public function estado()
    {
        return $this->belongsTo(EstadoProducto::class, 'id_estado', 'id_estado');
    }
}

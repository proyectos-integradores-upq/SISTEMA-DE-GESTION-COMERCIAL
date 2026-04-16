<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DatoFiscal extends Model
{
    protected $table = 'datos_fiscales';
    protected $primaryKey = 'id_dato_fiscal';
    public $timestamps = false;

    protected $fillable = [
        'id_cliente',
        'rfc',
        'razon_social',
        'uso_cfdi',
    ];
}

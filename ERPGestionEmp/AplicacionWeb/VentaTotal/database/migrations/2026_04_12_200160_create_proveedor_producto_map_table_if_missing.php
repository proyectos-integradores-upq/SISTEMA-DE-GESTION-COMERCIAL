<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('proveedor_producto_map')) {
            Schema::create('proveedor_producto_map', function (Blueprint $table) {
                $table->integer('id_map')->autoIncrement();
                $table->integer('id_producto_proveedor')->nullable();
                $table->integer('id_producto')->nullable();

                $table->foreign('id_producto_proveedor')
                    ->references('id_producto_proveedor')
                    ->on('productos_proveedor');

                $table->foreign('id_producto')
                    ->references('id_producto')
                    ->on('productos');
            });
        }
    }

    public function down(): void
    {
        // no-op to avoid accidental data loss
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('detalle_compra')) {
            Schema::create('detalle_compra', function (Blueprint $table) {
                $table->integer('id_detalle')->autoIncrement();
                $table->integer('id_compra')->nullable();
                $table->integer('id_producto_proveedor')->nullable();
                $table->integer('cantidad')->nullable();
                $table->decimal('precio_unitario', 10, 2)->nullable();

                $table->foreign('id_compra')
                    ->references('id_compra')
                    ->on('compras');

                $table->foreign('id_producto_proveedor')
                    ->references('id_producto_proveedor')
                    ->on('productos_proveedor');
            });
        }
    }

    public function down(): void
    {
        // no-op to avoid accidental data loss
    }
};

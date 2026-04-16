<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('detalle_venta')) {
            Schema::create('detalle_venta', function (Blueprint $table) {
                $table->integer('id_detalle')->autoIncrement();
                $table->integer('id_venta')->nullable();
                $table->integer('id_producto')->nullable();
                $table->integer('cantidad')->nullable();
                $table->decimal('precio_unitario', 10, 2)->nullable();
                $table->decimal('precio_compra', 10, 2)->nullable();

                $table->foreign('id_venta')
                    ->references('id_venta')
                    ->on('ventas');

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

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('movimientos_inventario')) {
            Schema::create('movimientos_inventario', function (Blueprint $table) {
                $table->integer('id_movimiento')->autoIncrement();
                $table->dateTime('fecha')->useCurrent();
                $table->integer('id_producto')->nullable();
                $table->integer('cantidad')->nullable();
                $table->enum('tipo', ['Entrada', 'Salida'])->nullable();
                $table->string('referencia', 100)->nullable();

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

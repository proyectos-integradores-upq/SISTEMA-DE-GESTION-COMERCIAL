<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('productos_proveedor')) {
            Schema::create('productos_proveedor', function (Blueprint $table) {
                $table->integer('id_producto_proveedor')->autoIncrement();
                $table->integer('id_proveedor')->nullable();
                $table->string('nombre', 150);
                $table->text('descripcion')->nullable();
                $table->decimal('precio_compra', 10, 2);

                $table->foreign('id_proveedor')
                    ->references('id_proveedor')
                    ->on('proveedores');
            });
        }
    }

    public function down(): void
    {
        // no-op to avoid accidental data loss
    }
};

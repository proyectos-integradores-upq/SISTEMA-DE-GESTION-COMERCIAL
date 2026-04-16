<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('compras')) {
            Schema::create('compras', function (Blueprint $table) {
                $table->integer('id_compra')->autoIncrement();
                $table->integer('id_proveedor')->nullable();
                $table->dateTime('fecha')->useCurrent();
                $table->decimal('total', 10, 2)->nullable();

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

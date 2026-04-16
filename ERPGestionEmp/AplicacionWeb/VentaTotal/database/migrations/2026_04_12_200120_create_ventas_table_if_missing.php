<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('ventas')) {
            Schema::create('ventas', function (Blueprint $table) {
                $table->integer('id_venta')->autoIncrement();
                $table->dateTime('fecha')->useCurrent();
                $table->decimal('total', 10, 2)->nullable();
                $table->string('metodo_pago', 50)->nullable();
                $table->integer('id_cliente')->nullable();
                $table->integer('id_dato_fiscal')->nullable();

                $table->foreign('id_cliente')
                    ->references('id_cliente')
                    ->on('clientes');

                $table->foreign('id_dato_fiscal')
                    ->references('id_dato_fiscal')
                    ->on('datos_fiscales');
            });
        }
    }

    public function down(): void
    {
        // no-op to avoid accidental data loss
    }
};

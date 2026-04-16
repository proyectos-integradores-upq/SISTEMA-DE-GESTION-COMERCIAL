<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('datos_fiscales')) {
            Schema::create('datos_fiscales', function (Blueprint $table) {
                $table->integer('id_dato_fiscal')->autoIncrement();
                $table->integer('id_cliente')->nullable();
                $table->string('rfc', 20)->nullable();
                $table->string('razon_social', 150)->nullable();
                $table->string('uso_cfdi', 50)->nullable();

                $table->foreign('id_cliente')
                    ->references('id_cliente')
                    ->on('clientes');
            });
        }
    }

    public function down(): void
    {
        // no-op to avoid accidental data loss
    }
};

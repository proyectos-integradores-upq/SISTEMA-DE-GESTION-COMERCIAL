<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('proveedores')) {
            Schema::create('proveedores', function (Blueprint $table) {
                $table->id('id_proveedor');
                $table->string('nombre', 150);
                $table->string('empresa', 150)->nullable();
                $table->string('telefono', 20)->nullable();
                $table->string('correo', 100)->nullable();
                $table->text('direccion')->nullable();
                $table->string('rfc', 20)->nullable();
                $table->enum('estado', ['Activo', 'Inactivo'])->default('Activo');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('proveedores');
    }
};

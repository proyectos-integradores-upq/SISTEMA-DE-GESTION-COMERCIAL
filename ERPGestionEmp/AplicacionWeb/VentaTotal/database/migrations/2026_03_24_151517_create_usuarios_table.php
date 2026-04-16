<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    
    
{
    if (!Schema::hasTable('usuarios')) {
    Schema::create('usuarios', function (Blueprint $table) {
        $table->id('id_usuario');
        $table->string('nombre');
        $table->string('telefono');
        $table->string('correo')->unique();
        $table->string('contrasena');
        $table->unsignedBigInteger('id_rol');
        $table->timestamps();
    });
    }
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('usuarios');
    }
};

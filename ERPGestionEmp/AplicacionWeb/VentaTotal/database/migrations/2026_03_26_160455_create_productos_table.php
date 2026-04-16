<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('productos')) {
            Schema::create('productos', function (Blueprint $table) {
                $table->id('id_producto');
                $table->string('codigo', 50)->unique();
                $table->string('nombre', 150);
                $table->text('descripcion')->nullable();
                $table->decimal('precio', 10, 2);
                $table->integer('stock')->default(0);
                $table->string('imagen', 255)->nullable();

                $table->unsignedBigInteger('id_categoria')->nullable();
                $table->unsignedBigInteger('id_estado')->nullable();

                $table->foreign('id_categoria')->references('id_categoria')->on('categorias');
                $table->foreign('id_estado')->references('id_estado')->on('estados_producto');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
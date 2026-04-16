<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('categorias')) {
            Schema::create('categorias', function (Blueprint $table) {
                $table->id('id_categoria');
                $table->string('nombre', 100);
                $table->text('descripcion')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('categorias');
    }
};
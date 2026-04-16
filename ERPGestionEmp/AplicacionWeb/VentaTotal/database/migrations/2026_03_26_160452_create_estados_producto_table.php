<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('estados_producto')) {
            Schema::create('estados_producto', function (Blueprint $table) {
                $table->id('id_estado');
                $table->string('nombre', 50);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('estados_producto');
    }
};
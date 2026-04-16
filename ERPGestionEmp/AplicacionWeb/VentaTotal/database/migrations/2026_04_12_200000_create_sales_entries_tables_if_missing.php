<?php

use Illuminate\Database\Migrations\Migration;


return new class extends Migration {
    public function up(): void
    {
        // Kept as no-op to preserve migration history in existing environments.
        // New environments should rely on individual migrations added after this one.
    }

    public function down(): void
    {
        // Intentionally no-op to avoid accidental data loss on rollback.
    }
};

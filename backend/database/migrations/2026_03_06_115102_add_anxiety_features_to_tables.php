<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('presence_status')->default('online')->nullable();
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->json('delivered_to')->nullable();
            $table->json('read_by')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('presence_status');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['delivered_to', 'read_by']);
        });
    }
};

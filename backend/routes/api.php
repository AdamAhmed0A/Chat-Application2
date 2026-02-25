<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/channels', [ChatController::class, 'getChannels']);
    Route::get('/channels/{channelId}/messages', [ChatController::class, 'getMessages']);
    Route::post('/channels/{channelId}/messages', [ChatController::class, 'sendMessage']);
});

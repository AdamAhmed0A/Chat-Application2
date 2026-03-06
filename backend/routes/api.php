<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);

Route::middleware(['auth:sanctum', \App\Http\Middleware\UpdateLastSeen::class])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::post('/me', [AuthController::class, 'updateProfile']); // Support multipart/form-data
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/me/presence', [AuthController::class, 'updatePresence']);

    Route::get('/channels', [ChatController::class, 'getChannels']);
    Route::get('/channels/{channelId}/messages', [ChatController::class, 'getMessages']);
    Route::post('/channels/{channelId}/messages', [ChatController::class, 'sendMessage']);
    Route::post('/channels/{channelId}/read', [ChatController::class, 'markAsRead']);
    Route::post('/channels/{channelId}/typing', [ChatController::class, 'typing']);
    
    // Message features
    Route::put('/messages/{id}', [ChatController::class, 'updateMessage']);
    Route::delete('/messages/{id}', [ChatController::class, 'deleteMessage']);
    Route::post('/messages/{id}/react', [ChatController::class, 'reactMessage']);

    // Find Users and Start Direct Messages
    Route::get('/users/search', [ChatController::class, 'searchUsers']);
    Route::post('/channels/direct', [ChatController::class, 'startDirectMessage']);
    Route::post('/channels/group', [ChatController::class, 'createGroup']);
    
    // AI Assistant
    Route::post('/ai/generate', [ChatController::class, 'generateAiMessage']);
});

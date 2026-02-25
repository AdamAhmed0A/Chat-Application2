<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\Message;
use App\Models\Attachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ChatController extends Controller
{
    public function getChannels()
    {
        $channels = Channel::all();
        if ($channels->isEmpty()) {
            $channels = collect([Channel::factory()->create(['name' => 'general'])]);
        }
        return response()->json([
            'status' => 'success',
            'channels' => $channels
        ]);
    }

    public function getMessages(Request $request, $channelId)
    {
        $lastId = $request->query('last_id', 0);

        $messages = Message::with(['user', 'attachments'])
            ->where('channel_id', $channelId)
            ->where('id', '>', $lastId)
            ->orderBy('id', 'asc')
            ->take(50)
            ->get();

        return response()->json([
            'status' => 'success',
            'messages' => $messages
        ]);
    }

    public function sendMessage(Request $request, $channelId)
    {
        $request->validate([
            'content' => 'nullable|string',
            'file' => 'nullable|file',
        ]);

        if (!$request->filled('content') && !$request->hasFile('file')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cannot send empty message'
            ], 400);
        }

        $message = Message::create([
            'channel_id' => $channelId,
            'user_id' => $request->user()->id,
            'content' => $request->content,
        ]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $path = $file->store('attachments', 'public');
            
            Attachment::create([
                'message_id' => $message->id,
                'file_path' => Storage::url($path),
                'file_type' => $file->getMimeType(),
            ]);
        }

        $message->load('user', 'attachments');

        return response()->json([
            'status' => 'success',
            'message' => $message
        ]);
    }
}

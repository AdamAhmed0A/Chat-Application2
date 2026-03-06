<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\Message;
use App\Models\Attachment;
use App\Events\MessageEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ChatController extends Controller
{
    public function getChannels(Request $request)
    {
        $user = $request->user();

        $channels = \App\Models\Channel::where('type', 'public')->get();

        $savedName = 'saved_' . $user->id;
        $savedChannel = \App\Models\Channel::firstOrCreate(
            ['name' => $savedName],
            ['type' => 'private']
        );

        $dmChannels = \App\Models\Channel::where('type', 'private')
            ->where(function ($q) use ($user) {
                // DM regex essentially
                $q->where('name', 'like', 'dm\_' . $user->id . '\_%')
                  ->orWhere('name', 'like', 'dm\_%\_' . $user->id)
                  // Group matches: group:(name):...,u_id,...
                  ->orWhere('name', 'like', '%:' . $user->id . ',%')
                  ->orWhere('name', 'like', '%,' . $user->id . ',%')
                  ->orWhere('name', 'like', '%,' . $user->id)
                  ->orWhere('name', 'like', 'group:%:'.$user->id);
            })->get();

        $channelList = $channels->map(function($c) {
            return [
                'id' => $c->id,
                'name' => $c->name,
                'is_saved' => false,
                'is_dm' => false
            ];
        });

        $channelList->push([
            'id' => $savedChannel->id,
            'name' => 'Saved Messages',
            'is_saved' => true,
            'is_dm' => false
        ]);

        foreach ($dmChannels as $dm) {
            // dm_1_2
            $parts = explode('_', $dm->name);
            if (count($parts) === 3) {
                $otherId = ($parts[1] == $user->id) ? $parts[2] : $parts[1];
                $otherUser = \App\Models\User::find($otherId);
                if ($otherUser) {
                    $channelList->push([
                        'id' => $dm->id,
                        'name' => $otherUser->name,
                        'avatar' => $otherUser->avatar,
                        'other_user_id' => $otherUser->id,
                        'is_saved' => false,
                        'is_dm' => true,
                        'is_group' => false,
                        'last_seen' => $otherUser->last_seen_at ? \Carbon\Carbon::parse($otherUser->last_seen_at)->diffForHumans() : 'Recently',
                        'is_online' => $otherUser->last_seen_at ? \Carbon\Carbon::parse($otherUser->last_seen_at)->diffInMinutes(now()) <= 2 : false,
                    ]);
                }
            } else if (str_starts_with($dm->name, 'group:')) {
                $parts = explode(':', $dm->name);
                if (count($parts) === 3) {
                    $userIds = explode(',', $parts[2]);
                    if (in_array($user->id, $userIds)) {
                        $channelList->push([
                            'id' => $dm->id,
                            'name' => $parts[1],
                            'is_saved' => false,
                            'is_dm' => false,
                            'is_group' => true,
                        ]);
                    }
                }
            }
        }

        $reads = \Illuminate\Support\Facades\DB::table('channel_reads')->where('user_id', $user->id)->pluck('last_read_message_id', 'channel_id');

        $finalChannels = collect($channelList)->map(function($c) use ($reads, $user) {
            $lastRead = $reads[$c['id']] ?? 0;
            $c['unread_count'] = \App\Models\Message::where('channel_id', $c['id'])
                ->where('id', '>', $lastRead)
                ->where('user_id', '!=', $user->id)
                ->where(function ($q) use ($user) {
                    $q->whereNull('deleted_for')
                      ->orWhereJsonDoesntContain('deleted_for', $user->id);
                })
                ->count();
            
            $c['last_message'] = \App\Models\Message::where('channel_id', $c['id'])
                ->where(function ($q) use ($user) {
                    $q->whereNull('deleted_for')
                      ->orWhereJsonDoesntContain('deleted_for', $user->id);
                })
                ->latest('id')->first();
                
            return $c;
        });

        return response()->json([
            'status' => 'success',
            'channels' => array_values($finalChannels->all())
        ]);
    }

    public function getMessages(Request $request, $channelId)
    {
        $lastId = $request->query('last_id', 0);
        $userId = $request->user()->id;

        $query = Message::with(['user', 'attachments'])
            ->where('channel_id', $channelId)
            ->where(function ($q) use ($userId) {
                // Return rows where deleted_for is null or the user's ID is not in the JSON array
                $q->whereNull('deleted_for')
                  ->orWhereJsonDoesntContain('deleted_for', $userId);
            });

        if ($lastId > 0) {
            $messages = $query->where('id', '>', $lastId)
                ->orderBy('id', 'asc')
                ->take(50)
                ->get();
        } else {
            $messages = $query->orderBy('id', 'desc')
                ->take(50)
                ->get()
                ->reverse()
                ->values();
        }

        $messagesDelivered = false;
        foreach ($messages as $msg) {
            if ($msg->user_id !== $userId) {
                $delivered = $msg->delivered_to ?: [];
                if (!in_array($userId, $delivered)) {
                    $delivered[] = $userId;
                    $msg->delivered_to = $delivered;
                    $msg->save();
                    broadcast(new MessageEvent('updated', $msg, $channelId))->toOthers();
                    $messagesDelivered = true;
                }
            }
        }
        
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
            'is_forwarded' => 'nullable|boolean',
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
            'is_forwarded' => $request->boolean('is_forwarded'),
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

        broadcast(new MessageEvent('new', $message, $channelId))->toOthers();

        return response()->json([
            'status' => 'success',
            'message' => $message
        ]);
    }

    public function updateMessage(Request $request, $id)
    {
        $message = Message::findOrFail($id);
        
        if ($message->user_id !== $request->user()->id) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
        }

        $request->validate(['content' => 'required|string']);

        $message->update([
            'content' => $request->content,
            'is_edited' => true,
        ]);

        $message->load('user', 'attachments');

        broadcast(new MessageEvent('updated', $message, $message->channel_id))->toOthers();

        return response()->json(['status' => 'success', 'message' => $message]);
    }

    public function deleteMessage(Request $request, $id)
    {
        $message = Message::findOrFail($id);
        $userId = $request->user()->id;
        $scope = $request->query('scope', 'me'); // 'me' or 'everyone'
        
        if ($scope === 'everyone') {
            if ($message->user_id !== $userId) {
                return response()->json(['status' => 'error', 'message' => 'Unauthorized to delete for everyone'], 403);
            }
            $channelId = $message->channel_id;
            $message->delete();
            broadcast(new MessageEvent('deleted', ['id' => $id, 'scope' => 'everyone'], $channelId))->toOthers();
        } else {
            // Delete for me
            $deletedFor = $message->deleted_for ?: [];
            if (!in_array($userId, $deletedFor)) {
                $deletedFor[] = $userId;
                $message->update(['deleted_for' => $deletedFor]);
            }
        }

        return response()->json(['status' => 'success']);
    }

    public function reactMessage(Request $request, $id)
    {
        $message = Message::findOrFail($id);
        $request->validate(['emoji' => 'required|string']);

        $emoji = $request->emoji;
        $reactions = $message->reactions ?: [];
        
        if (!isset($reactions[$emoji])) {
            $reactions[$emoji] = [];
        }

        $userId = $request->user()->id;
        
        if (in_array($userId, $reactions[$emoji])) {
            $reactions[$emoji] = array_values(array_diff($reactions[$emoji], [$userId]));
            if (empty($reactions[$emoji])) {
                unset($reactions[$emoji]);
            }
        } else {
            $reactions[$emoji][] = $userId;
        }

        $message->update(['reactions' => empty($reactions) ? null : $reactions]);
        $message->load('user', 'attachments');

        broadcast(new MessageEvent('reacted', $message, $message->channel_id))->toOthers();

        return response()->json(['status' => 'success', 'message' => $message]);
    }

    public function searchUsers(Request $request)
    {
        $query = $request->query('q', '');
        
        $usersQuery = \App\Models\User::where('id', '!=', $request->user()->id);

        if (strlen($query) >= 2) {
            $usersQuery->where('name', 'like', '%' . $query . '%');
        }

        $users = $usersQuery->take(10)->get(['id', 'name', 'status_message']);

        return response()->json(['status' => 'success', 'users' => $users]);
    }

    public function startDirectMessage(Request $request)
    {
        $request->validate(['target_user_id' => 'required|integer']);
        $user1 = $request->user()->id;
        $user2 = $request->target_user_id;

        if ($user1 == $user2) {
            return response()->json(['status' => 'error', 'message' => 'Cannot DM yourself'], 400);
        }

        $min = min($user1, $user2);
        $max = max($user1, $user2);
        $dmName = "dm_{$min}_{$max}";

        $channel = \App\Models\Channel::firstOrCreate(
            ['name' => $dmName],
            ['type' => 'private']
        );

        $otherUser = \App\Models\User::find($user2);

        return response()->json([
            'status' => 'success',
            'channel' => [
                'id' => $channel->id,
                'name' => $otherUser->name ?? "User $user2",
                'avatar' => $otherUser->avatar ?? null,
                'is_saved' => false,
                'is_dm' => true,
                'last_seen' => $otherUser->last_seen_at ? \Carbon\Carbon::parse($otherUser->last_seen_at)->diffForHumans() : 'Recently',
                'is_online' => $otherUser->last_seen_at ? \Carbon\Carbon::parse($otherUser->last_seen_at)->diffInMinutes(now()) <= 2 : false,
            ]
        ]);
    }

    public function createGroup(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'user_ids' => 'required|array',
            'user_ids.*' => 'integer'
        ]);

        $userIds = $request->user_ids;
        $userIds[] = $request->user()->id; // Auto include creator
        $userIds = array_unique($userIds);
        sort($userIds);

        $groupName = 'group:' . $request->name . ':' . implode(',', $userIds);

        $channel = \App\Models\Channel::create([
            'name' => $groupName,
            'type' => 'private'
        ]);

        return response()->json([
            'status' => 'success',
            'channel' => [
                'id' => $channel->id,
                'name' => $request->name,
                'is_saved' => false,
                'is_dm' => false,
                'is_group' => true
            ]
        ]);
    }

    public function markAsRead(Request $request, $channelId)
    {
        $user = $request->user();
        $lastMessage = Message::where('channel_id', $channelId)->latest('id')->first();
        if ($lastMessage) {
            \Illuminate\Support\Facades\DB::table('channel_reads')->updateOrInsert(
                ['channel_id' => $channelId, 'user_id' => $user->id],
                ['last_read_message_id' => $lastMessage->id, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // Mark all completely unread messages as read by this user
        $unreadMessages = Message::where('channel_id', $channelId)
            ->where('user_id', '!=', $user->id)
            ->where(function ($query) use ($user) {
                $query->whereNull('read_by')
                      ->orWhereJsonDoesntContain('read_by', $user->id);
            })->get();

        foreach ($unreadMessages as $msg) {
            $readBy = $msg->read_by ?: [];
            if (!in_array($user->id, $readBy)) {
                $readBy[] = $user->id;
                $msg->read_by = $readBy;

                $delivered = $msg->delivered_to ?: [];
                if (!in_array($user->id, $delivered)) {
                    $delivered[] = $user->id;
                    $msg->delivered_to = $delivered;
                }

                $msg->save();
                $msg->load('user', 'attachments');
                // Broadcast updated to let sender know it was read
                broadcast(new MessageEvent('updated', $msg, $channelId))->toOthers();
            }
        }

        return response()->json(['status' => 'success']);
    }

    public function typing(Request $request, $channelId)
    {
        broadcast(new MessageEvent('typing', ['user' => $request->user()], $channelId))->toOthers();
        return response()->json(['status' => 'success']);
    }

    public function generateAiMessage(Request $request)
    {
        $request->validate(['prompt' => 'required|string']);
        
        // Mock a 1.5s delay to simulate AI parsing/generation
        usleep(1500000); 
        
        // In a real application, you would make an HTTP call to OpenAI/Anthropic/Gemini here.
        $generated = "Here is a drafted message regarding: '" . $request->prompt . "'. Please let me know if you need any adjustments.";

        return response()->json([
            'status' => 'success',
            'generated_text' => $generated
        ]);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    protected $fillable = ['channel_id', 'user_id', 'content', 'reactions', 'is_forwarded', 'is_edited', 'deleted_for', 'delivered_to', 'read_by'];

    protected $casts = [
        'reactions' => 'array',
        'is_forwarded' => 'boolean',
        'is_edited' => 'boolean',
        'deleted_for' => 'array',
        'delivered_to' => 'array',
        'read_by' => 'array',
    ];

    public function user() {
        return $this->belongsTo(User::class);
    }

    public function channel() {
        return $this->belongsTo(Channel::class);
    }

    public function attachments() {
        return $this->hasMany(Attachment::class);
    }
}

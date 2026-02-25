<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Channel extends Model
{
    use HasFactory;
    
    protected $fillable = ['name', 'type'];

    public function messages() {
        return $this->hasMany(Message::class);
    }
}

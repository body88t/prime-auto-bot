package com.prime.autobot.sms_listener

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i("PrimeBootReceiver", "Device boot completed. Prime SMS listener registered.")
        }
    }
}

package com.prime.autobot.sms_listener

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PrimeSmsReceiver"

        val WHITELISTED_SENDERS = listOf(
            "VF-Cash", "VF-CASH", "VodafoneCash", "Vodafone", "VODAFONE",
            "InstaPay", "INSTAPAY", "IPN",
            "OrangeCash", "Orange Cash", "Orange",
            "EtisalatCash", "Etisalat Cash", "Etisalat", "e& money",
            "WEPay", "WE Pay",
            "CIB", "CIBEgypt", "BM", "Banque Misr", "NBE", "ALAHLY", "QNB"
        )
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        for (sms in messages) {
            val sender = sms.displayOriginatingAddress ?: sms.originatingAddress ?: continue
            val rawBody = sms.displayMessageBody ?: sms.messageBody ?: continue
            val timestamp = sms.timestampMillis

            Log.d(TAG, "Intercepted SMS from: $sender")

            // Strict Sender Whitelisting
            if (!isSenderWhitelisted(sender)) {
                Log.d(TAG, "Ignored SMS from non-whitelisted sender: $sender")
                continue
            }

            Log.i(TAG, "Processing whitelisted banking SMS from: $sender")

            // Parse Amount and Reference
            val amount = extractAmount(rawBody)
            val referenceId = extractReference(rawBody)

            // Forward to Backend Gateway asynchronously
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    forwardSmsToBackend(context, sender, rawBody, amount, referenceId, timestamp)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to forward SMS to backend", e)
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    private fun isSenderWhitelisted(sender: String): Boolean {
        val cleanSender = sender.trim().lowercase()
        return WHITELISTED_SENDERS.any { whitelisted ->
            val cleanW = whitelisted.trim().lowercase()
            cleanSender == cleanW || cleanSender.contains(cleanW) || cleanW.contains(cleanSender)
        }
    }

    private fun extractAmount(text: String): Double? {
        val normalized = normalizeArabicNumerals(text)
        val regex = Regex("""(?:مبلغ|استلام|تحويل|إيداع|بقيمة|EGP|LE)\s*:?\s*([0-9]+(?:\.[0-9]+)?)""", RegexOption.IGNORE_CASE)
        val match = regex.find(normalized) ?: Regex("""([0-9]+(?:\.[0-9]+)?)\s*(?:جنيه|جم|ج\.م|ج|EGP|LE)""").find(normalized)
        return match?.groupValues?.get(1)?.toDoubleOrNull()
    }

    private fun extractReference(text: String): String? {
        val normalized = normalizeArabicNumerals(text)
        val regex = Regex("""(?:رقم العملية|مرجع المعاملة|رقم المرجع|كود العملية|Transaction\s*ID|Txn\s*ID|Ref\s*ID|Ref)\s*[:#\-]?\s*([A-Za-z0-9\-_]{6,30})""", RegexOption.IGNORE_CASE)
        val match = regex.find(normalized)
        return match?.groupValues?.get(1)?.trim()
    }

    private fun normalizeArabicNumerals(text: String): String {
        var res = text
        val arabic = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')
        for (i in arabic.indices) {
            res = res.replace(arabic[i], (i + '0'.code).toChar())
        }
        return res
    }

    private fun forwardSmsToBackend(
        context: Context,
        sender: String,
        rawMessage: String,
        amount: Double?,
        referenceId: String?,
        timestamp: Long
    ) {
        val prefs = context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("flutter.server_url", "http://10.0.2.2:3000") ?: "http://10.0.2.2:3000"
        val apiKey = prefs.getString("flutter.internal_sync_key", "prime_sms_secret_token_8899aabbcc") ?: "prime_sms_secret_token_8899aabbcc"

        val endpoint = "${serverUrl.trimEnd('/')}/api/v1/sms/incoming"

        val jsonBody = JSONObject().apply {
            put("sender", sender)
            put("rawMessage", rawMessage)
            put("timestamp", timestamp)
            if (amount != null) put("amount", amount)
            if (referenceId != null) put("referenceId", referenceId)
        }

        val requestBody = jsonBody.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder()
            .url(endpoint)
            .addHeader("x-api-key", apiKey)
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()
        Log.i(TAG, "Forwarded SMS to $endpoint, HTTP response code: ${response.code}")
    }
}

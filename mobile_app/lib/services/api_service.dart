import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/sms_item.dart';

class ApiService {
  static Future<bool> pingServer(String serverUrl, String apiKey) async {
    try {
      final uri = Uri.parse('${serverUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1/sms/ping');
      final response = await http.get(
        uri,
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  static Future<Map<String, dynamic>> forwardSms({
    required String serverUrl,
    required String apiKey,
    required SmsItem sms,
  }) async {
    final uri = Uri.parse('${serverUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1/sms/incoming');

    final payload = {
      'sender': sms.sender,
      'rawMessage': sms.rawMessage,
      'amount': sms.amount,
      'referenceId': sms.referenceId,
      'timestamp': sms.timestamp.toIso8601String(),
    };

    try {
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 15));

      final data = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Server responded with code ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}

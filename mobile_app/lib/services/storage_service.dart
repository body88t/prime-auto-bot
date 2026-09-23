import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/sms_item.dart';
import 'api_service.dart';
import 'sms_parser.dart';

class StorageService extends ChangeNotifier {
  static const _keyServerUrl = 'server_url';
  static const _keyApiKey = 'internal_sync_key';
  static const _keyIsActive = 'is_listener_active';
  static const _keySmsLogs = 'sms_logs';

  String _serverUrl = 'https://overview-suitable-locking-success.trycloudflare.com';
  String _apiKey = 'prime_sms_secret_token_8899aabbcc';
  bool _isListenerActive = true;
  bool _isServerConnected = false;
  List<SmsItem> _logs = [];

  String get serverUrl => _serverUrl;
  String get apiKey => _apiKey;
  bool get isListenerActive => _isListenerActive;
  bool get isServerConnected => _isServerConnected;
  List<SmsItem> get logs => List.unmodifiable(_logs);

  int get totalReceived => _logs.length;
  int get totalForwarded => _logs.where((s) => s.isForwarded).length;
  int get totalFiltered => _logs.where((s) => !s.isWhitelisted).length;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _serverUrl = prefs.getString(_keyServerUrl) ?? 'https://overview-suitable-locking-success.trycloudflare.com';
    _apiKey = prefs.getString(_keyApiKey) ?? 'prime_sms_secret_token_8899aabbcc';
    _isListenerActive = prefs.getBool(_keyIsActive) ?? true;

    final logsRaw = prefs.getStringList(_keySmsLogs) ?? [];
    _logs = logsRaw.map((e) => SmsItem.fromJson(jsonDecode(e))).toList();

    notifyListeners();
    checkConnection();
  }

  Future<void> updateSettings(String serverUrl, String apiKey) async {
    _serverUrl = serverUrl.trim();
    _apiKey = apiKey.trim();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyServerUrl, _serverUrl);
    await prefs.setString(_keyApiKey, _apiKey);

    notifyListeners();
    await checkConnection();
  }

  Future<void> setListenerActive(bool active) async {
    _isListenerActive = active;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsActive, active);
    notifyListeners();
  }

  Future<bool> checkConnection() async {
    final connected = await ApiService.pingServer(_serverUrl, _apiKey);
    _isServerConnected = connected;
    notifyListeners();
    return connected;
  }

  Future<void> processAndRecordSms(String sender, String rawMessage) async {
    final parsed = SmsParser.parse(sender, rawMessage);

    final item = SmsItem(
      id: 'sms_${DateTime.now().millisecondsSinceEpoch}',
      sender: sender,
      rawMessage: rawMessage,
      amount: parsed.amount,
      referenceId: parsed.referenceId,
      timestamp: parsed.timestamp,
      isWhitelisted: parsed.isWhitelisted,
    );

    if (!_isListenerActive) {
      _addLog(item);
      return;
    }

    if (!parsed.isWhitelisted) {
      _addLog(item);
      return;
    }

    // Forward to backend
    final res = await ApiService.forwardSms(
      serverUrl: _serverUrl,
      apiKey: _apiKey,
      sms: item,
    );

    final updatedItem = SmsItem(
      id: item.id,
      sender: item.sender,
      rawMessage: item.rawMessage,
      amount: item.amount,
      referenceId: item.referenceId,
      timestamp: item.timestamp,
      isWhitelisted: item.isWhitelisted,
      isForwarded: res['success'] == true,
      forwardError: res['error'],
    );

    _addLog(updatedItem);
  }

  Future<void> retryForward(SmsItem item) async {
    final res = await ApiService.forwardSms(
      serverUrl: _serverUrl,
      apiKey: _apiKey,
      sms: item,
    );

    final index = _logs.indexWhere((l) => l.id == item.id);
    if (index != -1) {
      _logs[index] = SmsItem(
        id: item.id,
        sender: item.sender,
        rawMessage: item.rawMessage,
        amount: item.amount,
        referenceId: item.referenceId,
        timestamp: item.timestamp,
        isWhitelisted: item.isWhitelisted,
        isForwarded: res['success'] == true,
        forwardError: res['error'],
      );
      _persistLogs();
      notifyListeners();
    }
  }

  Future<void> clearLogs() async {
    _logs.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySmsLogs);
    notifyListeners();
  }

  void _addLog(SmsItem item) {
    _logs.insert(0, item);
    if (_logs.length > 200) {
      _logs.removeLast();
    }
    _persistLogs();
    notifyListeners();
  }

  Future<void> _persistLogs() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = _logs.map((e) => jsonEncode(e.toJson())).toList();
    await prefs.setStringList(_keySmsLogs, raw);
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/storage_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _urlController;
  late TextEditingController _keyController;
  bool _isTesting = false;
  String? _testMessage;
  bool? _testSuccess;

  @override
  void initState() {
    super.initState();
    final storage = Provider.of<StorageService>(context, listen: false);
    _urlController = TextEditingController(text: storage.serverUrl);
    _keyController = TextEditingController(text: storage.apiKey);
  }

  @override
  void dispose() {
    _urlController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    setState(() {
      _isTesting = true;
      _testMessage = null;
    });

    final storage = Provider.of<StorageService>(context, listen: false);
    await storage.updateSettings(_urlController.text, _keyController.text);
    final success = await storage.checkConnection();

    setState(() {
      _isTesting = false;
      _testSuccess = success;
      _testMessage = success
          ? 'Successfully reached Prime Auto Bot gateway!'
          : 'Failed to connect. Ensure backend is running and URL is reachable.';
    });
  }

  void _saveSettings() async {
    final storage = Provider.of<StorageService>(context, listen: false);
    await storage.updateSettings(_urlController.text, _keyController.text);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Settings saved successfully!'), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Gateway Configuration', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Backend Gateway URL',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _urlController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'https://prime-auto-bot.onrender.com',
                hintStyle: const TextStyle(color: Colors.white30),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                prefixIcon: const Icon(Icons.dns, color: Colors.blueAccent),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enter your permanent Cloud Server URL (e.g. Render.com):\nDefault: https://prime-auto-bot.onrender.com',
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),

            const SizedBox(height: 24),

            const Text(
              'Internal SMS Sync Key (x-api-key)',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _keyController,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Enter secret API token',
                hintStyle: const TextStyle(color: Colors.white30),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                prefixIcon: const Icon(Icons.vpn_key, color: Colors.amberAccent),
              ),
            ),

            const SizedBox(height: 24),

            if (_testMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: (_testSuccess == true ? Colors.green : Colors.red).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _testSuccess == true ? Colors.green : Colors.red),
                ),
                child: Row(
                  children: [
                    Icon(_testSuccess == true ? Icons.check_circle : Icons.error, color: _testSuccess == true ? Colors.green : Colors.red, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _testMessage!,
                        style: TextStyle(color: _testSuccess == true ? Colors.greenAccent : Colors.redAccent, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white24),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: _isTesting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.network_check, size: 18),
                    label: const Text('Test Connection'),
                    onPressed: _isTesting ? null : _testConnection,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blueAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.save, size: 18),
                    label: const Text('Save Settings'),
                    onPressed: _saveSettings,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

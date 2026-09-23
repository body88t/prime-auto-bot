import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/sms_parser.dart';
import '../services/storage_service.dart';

class ParserTesterScreen extends StatefulWidget {
  const ParserTesterScreen({super.key});

  @override
  State<ParserTesterScreen> createState() => _ParserTesterScreenState();
}

class _ParserTesterScreenState extends State<ParserTesterScreen> {
  final _senderController = TextEditingController(text: 'VF-Cash');
  final _messageController = TextEditingController(
    text: 'تم استلام مبلغ 200.00 جنيه من 01012345678. مصاريف الخدمة 0.00 جنيه. رصيدك الحالي هو 1500.00 جنيه. رقم العملية: 823491823',
  );

  ParsedSms? _parsed;

  @override
  void initState() {
    super.initState();
    _runParse();
  }

  void _runParse() {
    setState(() {
      _parsed = SmsParser.parse(_senderController.text, _messageController.text);
    });
  }

  void _loadPreset(String sender, String message) {
    _senderController.text = sender;
    _messageController.text = message;
    _runParse();
  }

  @override
  Widget build(BuildContext context) {
    final storage = Provider.of<StorageService>(context, listen: false);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('SMS Parser Sandbox', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Test Presets', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(
                  label: const Text('Vodafone Cash (200 EGP)'),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: const TextStyle(color: Colors.redAccent, fontSize: 12),
                  onPressed: () => _loadPreset(
                    'VF-Cash',
                    'تم استلام مبلغ 200.00 جنيه من 01012345678. مصاريف الخدمة 0.00 جنيه. رصيدك الحالي هو 1500.00 جنيه. رقم العملية: 823491823',
                  ),
                ),
                ActionChip(
                  label: const Text('InstaPay (200 EGP)'),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: const TextStyle(color: Colors.purpleAccent, fontSize: 12),
                  onPressed: () => _loadPreset(
                    'InstaPay',
                    'تم استلام تحويل لحظي بمبلغ 200.00 جم من أحمد محمد عبر إنستاباي. مرجع المعاملة: IPN394829104',
                  ),
                ),
                ActionChip(
                  label: const Text('Partial Deposit (100 EGP)'),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: const TextStyle(color: Colors.amberAccent, fontSize: 12),
                  onPressed: () => _loadPreset(
                    'VF-Cash',
                    'تم استلام مبلغ 100.00 جنيه من 01099887766. رقم العملية: 554433221',
                  ),
                ),
                ActionChip(
                  label: const Text('Personal Contact (Discarded)'),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: const TextStyle(color: Colors.grey, fontSize: 12),
                  onPressed: () => _loadPreset(
                    '01099998888',
                    'يا أسطى حولتلك ٢٠٠ جنيه شوف وصلت ولا لأ',
                  ),
                ),
              ],
            ),

            const SizedBox(height: 18),

            const Text('Sender Address', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70)),
            const SizedBox(height: 6),
            TextField(
              controller: _senderController,
              style: const TextStyle(color: Colors.white),
              onChanged: (_) => _runParse(),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
            ),

            const SizedBox(height: 14),

            const Text('Raw SMS Message Text', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70)),
            const SizedBox(height: 6),
            TextField(
              controller: _messageController,
              maxLines: 4,
              style: const TextStyle(color: Colors.white),
              onChanged: (_) => _runParse(),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
            ),

            const SizedBox(height: 20),

            // Parsed Result Card
            if (_parsed != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _parsed!.isWhitelisted ? Colors.green.shade700 : Colors.red.shade700),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Extraction Results', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _parsed!.isWhitelisted ? Colors.green.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _parsed!.isWhitelisted ? 'Whitelisted Sender ✓' : 'Blacklisted / Personal ✗',
                            style: TextStyle(
                              color: _parsed!.isWhitelisted ? Colors.greenAccent : Colors.redAccent,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 20),
                    _buildRow('Detected Amount:', _parsed!.amount != null ? '${_parsed!.amount} EGP' : 'None detected', Colors.cyanAccent),
                    const SizedBox(height: 6),
                    _buildRow('Reference / Txn ID:', _parsed!.referenceId ?? 'None detected', Colors.purpleAccent),
                    const SizedBox(height: 6),
                    _buildRow('Action Taken:', _parsed!.isWhitelisted && _parsed!.amount != null ? 'Ready for Instant Forwarding' : 'Ignored locally', Colors.white70),
                  ],
                ),
              ),

            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blueAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.send),
                label: const Text('Simulate Ingestion & Forward to Backend'),
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  await storage.processAndRecordSms(_senderController.text, _messageController.text);
                  if (!mounted) return;
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Simulated SMS processed! Check logs.'), backgroundColor: Colors.green),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(String title, String val, Color valColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(color: Colors.white60, fontSize: 13)),
        Text(val, style: TextStyle(color: valColor, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }
}

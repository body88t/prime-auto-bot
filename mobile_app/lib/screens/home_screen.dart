import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../services/storage_service.dart';
import '../models/sms_item.dart';
import 'logs_screen.dart';
import 'settings_screen.dart';
import 'parser_tester_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final storage = Provider.of<StorageService>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.blue.shade600,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.sync_alt, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Prime SMS Listener',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            tooltip: 'Refresh Connection',
            onPressed: () => storage.checkConnection(),
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white70),
            tooltip: 'Settings',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: storage.isServerConnected ? Colors.green.shade600 : Colors.amber.shade700,
                  width: 1.5,
                ),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: storage.isServerConnected ? Colors.greenAccent : Colors.amber,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            storage.isServerConnected ? 'Gateway Connected' : 'Gateway Disconnected',
                            style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white, fontSize: 16),
                          ),
                        ],
                      ),
                      Switch(
                        value: storage.isListenerActive,
                        activeThumbColor: Colors.blueAccent,
                        onChanged: (val) => storage.setListenerActive(val),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.link, size: 16, color: Colors.white54),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          storage.serverUrl,
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: storage.isServerConnected ? Colors.greenAccent : Colors.amberAccent,
                        side: BorderSide(
                          color: storage.isServerConnected ? Colors.green.withValues(alpha: 0.5) : Colors.amber.withValues(alpha: 0.5),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.network_ping, size: 16),
                      label: const Text('Ping / Test Connection', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      onPressed: () async {
                        final messenger = ScaffoldMessenger.of(context);
                        final ok = await storage.checkConnection();
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(ok ? '✅ Connected to Prime Auto Bot Gateway!' : '❌ Cannot reach Gateway. Check URL/Internet.'),
                            backgroundColor: ok ? Colors.green : Colors.red,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Statistics Row
            Row(
              children: [
                _buildStatCard('Total SMS', storage.totalReceived.toString(), Icons.inbox, Colors.blue),
                const SizedBox(width: 12),
                _buildStatCard('Forwarded', storage.totalForwarded.toString(), Icons.check_circle, Colors.green),
                const SizedBox(width: 12),
                _buildStatCard('Filtered', storage.totalFiltered.toString(), Icons.filter_alt, Colors.orange),
              ],
            ),

            const SizedBox(height: 24),

            // Quick Actions
            const Text(
              'Quick Tools',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E293B),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.receipt_long, color: Colors.cyanAccent),
                    label: const Text('View Logs'),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const LogsScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E293B),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.science, color: Colors.amberAccent),
                    label: const Text('SMS Sandbox'),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ParserTesterScreen()),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Live Intercepted Transactions Feed
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.stream, color: Colors.greenAccent, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Live Bank Transactions Feed',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LogsScreen()),
                  ),
                  child: const Text('View All', style: TextStyle(color: Colors.blueAccent, fontSize: 13)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (storage.logs.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.mark_email_unread_outlined, size: 36, color: Colors.white30),
                    SizedBox(height: 8),
                    Text(
                      'No transaction SMS intercepted yet',
                      style: TextStyle(color: Colors.white60, fontSize: 13),
                    ),
                    Text(
                      'Any incoming bank/wallet SMS will appear here automatically',
                      style: TextStyle(color: Colors.white38, fontSize: 11),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: storage.logs.take(5).length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = storage.logs[index];
                  return _buildTransactionCard(context, item);
                },
              ),

            const SizedBox(height: 24),

            // Whitelisted Senders Information
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B).withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white10),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.shield_outlined, color: Colors.blueAccent, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Active Sender Whitelist',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Listening exclusively for banking & wallet notifications:\n• Vodafone Cash (VF-Cash)\n• InstaPay Egypt (IPN)\n• Orange Cash & Etisalat Cash\n• CIB, Banque Misr, NBE, QNB\nAll personal messages are ignored and discarded locally.',
                    style: TextStyle(color: Colors.white60, fontSize: 13, height: 1.5),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String count, IconData icon, MaterialColor color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          children: [
            Icon(icon, color: color.shade400, size: 24),
            const SizedBox(height: 8),
            Text(
              count,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(fontSize: 12, color: Colors.white60),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionCard(BuildContext context, SmsItem item) {
    final timeStr = DateFormat('HH:mm:ss - dd/MM').format(item.timestamp);

    Color statusColor = Colors.grey;
    String statusText = 'Filtered';
    IconData statusIcon = Icons.filter_alt;

    if (item.isWhitelisted) {
      if (item.isForwarded) {
        statusColor = Colors.green;
        statusText = 'Synced';
        statusIcon = Icons.check_circle;
      } else {
        statusColor = Colors.red;
        statusText = 'Sync Failed';
        statusIcon = Icons.error_outline;
      }
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: item.isForwarded ? Colors.green.withValues(alpha: 0.3) : Colors.white12,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.blue.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      item.sender,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.blueAccent),
                    ),
                  ),
                  if (item.amount != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      '${item.amount!.toStringAsFixed(item.amount!.truncateToDouble() == item.amount ? 0 : 2)} EGP',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.cyanAccent),
                    ),
                  ],
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  children: [
                    Icon(statusIcon, size: 12, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      statusText,
                      style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item.rawMessage,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (item.referenceId != null && item.referenceId!.isNotEmpty)
                Text(
                  'Ref: ${item.referenceId}',
                  style: const TextStyle(color: Colors.purpleAccent, fontSize: 11, fontWeight: FontWeight.w500),
                )
              else
                const SizedBox(),
              Text(
                timeStr,
                style: const TextStyle(color: Colors.white38, fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

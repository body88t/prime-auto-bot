import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/sms_item.dart';
import '../services/storage_service.dart';

class LogsScreen extends StatelessWidget {
  const LogsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final storage = Provider.of<StorageService>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Intercepted SMS Logs', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep, color: Colors.redAccent),
            tooltip: 'Clear Logs',
            onPressed: () => _confirmClear(context, storage),
          ),
        ],
      ),
      body: storage.logs.isEmpty
          ? const Center(
              child: Text(
                'No intercepted SMS records yet.',
                style: TextStyle(color: Colors.white54, fontSize: 16),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: storage.logs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = storage.logs[index];
                return _buildLogCard(context, item, storage);
              },
            ),
    );
  }

  Widget _buildLogCard(BuildContext context, SmsItem item, StorageService storage) {
    final timeStr = DateFormat('yyyy-MM-dd HH:mm:ss').format(item.timestamp);

    Color statusColor = Colors.grey;
    String statusText = 'Filtered (Non-bank)';
    IconData statusIcon = Icons.filter_alt;

    if (item.isWhitelisted) {
      if (item.isForwarded) {
        statusColor = Colors.green;
        statusText = 'Forwarded';
        statusIcon = Icons.check_circle;
      } else {
        statusColor = Colors.red;
        statusText = 'Failed Forwarding';
        statusIcon = Icons.error_outline;
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                item.sender,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    Icon(statusIcon, size: 14, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      statusText,
                      style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.rawMessage,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (item.amount != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${item.amount} EGP',
                    style: const TextStyle(color: Colors.cyanAccent, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              if (item.referenceId != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.purple.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Ref: ${item.referenceId}',
                    style: const TextStyle(color: Colors.purpleAccent, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              const Spacer(),
              Text(
                timeStr,
                style: const TextStyle(color: Colors.white38, fontSize: 11),
              ),
            ],
          ),
          if (item.isWhitelisted && !item.isForwarded) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                style: TextButton.styleFrom(foregroundColor: Colors.blueAccent),
                icon: const Icon(Icons.replay, size: 16),
                label: const Text('Retry Forwarding', style: TextStyle(fontSize: 12)),
                onPressed: () => storage.retryForward(item),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _confirmClear(BuildContext context, StorageService storage) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Clear all logs?', style: TextStyle(color: Colors.white)),
        content: const Text('This will delete the local history of intercepted SMS messages.', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(ctx),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Clear', style: TextStyle(color: Colors.white)),
            onPressed: () {
              storage.clearLogs();
              Navigator.pop(ctx);
            },
          ),
        ],
      ),
    );
  }
}

class SmsItem {
  final String id;
  final String sender;
  final String rawMessage;
  final double? amount;
  final String? referenceId;
  final DateTime timestamp;
  final bool isWhitelisted;
  final bool isForwarded;
  final String? forwardError;

  SmsItem({
    required this.id,
    required this.sender,
    required this.rawMessage,
    this.amount,
    this.referenceId,
    required this.timestamp,
    required this.isWhitelisted,
    this.isForwarded = false,
    this.forwardError,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'sender': sender,
        'rawMessage': rawMessage,
        'amount': amount,
        'referenceId': referenceId,
        'timestamp': timestamp.toIso8601String(),
        'isWhitelisted': isWhitelisted,
        'isForwarded': isForwarded,
        'forwardError': forwardError,
      };

  factory SmsItem.fromJson(Map<String, dynamic> json) => SmsItem(
        id: json['id'],
        sender: json['sender'],
        rawMessage: json['rawMessage'],
        amount: (json['amount'] as num?)?.toDouble(),
        referenceId: json['referenceId'],
        timestamp: DateTime.parse(json['timestamp']),
        isWhitelisted: json['isWhitelisted'] ?? true,
        isForwarded: json['isForwarded'] ?? false,
        forwardError: json['forwardError'],
      );
}

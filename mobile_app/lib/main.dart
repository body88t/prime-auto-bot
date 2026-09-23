import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'services/storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = StorageService();
  await storageService.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: storageService),
      ],
      child: const PrimeSmsListenerApp(),
    ),
  );
}

class PrimeSmsListenerApp extends StatefulWidget {
  const PrimeSmsListenerApp({super.key});

  @override
  State<PrimeSmsListenerApp> createState() => _PrimeSmsListenerAppState();
}

class _PrimeSmsListenerAppState extends State<PrimeSmsListenerApp> {
  @override
  void initState() {
    super.initState();
    _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    try {
      await [
        Permission.sms,
        Permission.notification,
      ].request();
    } catch (e) {
      debugPrint('Permission request error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Prime SMS Listener',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

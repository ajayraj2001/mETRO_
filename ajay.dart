// Main structure of the Flutter app

// pubspec.yaml dependencies
/*
dependencies:
  flutter:
    sdk: flutter
  socket_io_client: ^2.0.0
  provider: ^6.0.2
  http: ^0.13.4
  shared_preferences: ^2.0.13
  intl: ^0.17.0
  cached_network_image: ^3.2.0
  flutter_sound: ^9.2.13
  file_picker: ^4.5.1
  camera: ^0.10.0
  path_provider: ^2.0.9
  flutter_local_notifications: ^9.4.0
*/

// lib/main.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whatsapp_clone/providers/auth_provider.dart';
import 'package:whatsapp_clone/providers/chat_provider.dart';
import 'package:whatsapp_clone/screens/splash_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
      ],
      child: MaterialApp(
        title: 'WhatsApp Clone',
        theme: ThemeData(
          primaryColor: const Color(0xFF075E54),
          colorScheme: ColorScheme.fromSwatch().copyWith(
            secondary: const Color(0xFF128C7E),
          ),
        ),
        home: const SplashScreen(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}

// lib/services/socket_service.dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  late IO.Socket socket;
  static final SocketService _instance = SocketService._internal();
  
  factory SocketService() {
    return _instance;
  }
  
  SocketService._internal();

  void initSocket(String userId) {
    // Connect to the socket server
    socket = IO.io('http://your-server-ip:5000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });

    // Connect to socket
    socket.connect();

    // Socket connection event
    socket.onConnect((_) {
      print('Socket connected: ${socket.id}');
      socket.emit('user_connected', userId);
    });

    // Socket connection error
    socket.onConnectError((error) {
      print('Connection error: $error');
    });

    // Socket disconnection
    socket.onDisconnect((_) {
      print('Socket disconnected');
    });
  }

  void sendMessage(Map<String, dynamic> messageData) {
    socket.emit('send_message', messageData);
  }
  
  void markMessageAsRead(String messageId) {
    socket.emit('message_read', messageId);
  }
  
  void emitTyping(String senderId, String receiverId, bool isTyping) {
    socket.emit('typing', {
      'senderId': senderId,
      'receiverId': receiverId,
      'isTyping': isTyping
    });
  }
  
  void disconnect() {
    socket.disconnect();
  }
  
  void onNewMessage(Function(Map<String, dynamic>) callback) {
    socket.on('new_message', (data) => callback(data));
  }
  
  void onMessageStatusUpdated(Function(Map<String, dynamic>) callback) {
    socket.on('message_status_updated', (data) => callback(data));
  }
  
  void onMessageRead(Function(String) callback) {
    socket.on('message_read', (messageId) => callback(messageId));
  }
  
  void onTypingIndicator(Function(Map<String, dynamic>) callback) {
    socket.on('typing_indicator', (data) => callback(data));
  }
  
  void onUserStatusChanged(Function(Map<String, dynamic>) callback) {
    socket.on('user_status_changed', (data) => callback(data));
  }
}

// lib/models/message.dart
class Message {
  final String id;
  final String senderId;
  final String receiverId;
  final String content;
  final DateTime timestamp;
  String status; // 'sent', 'delivered', 'read'
  DateTime? readAt;
  String? mediaUrl;
  
  Message({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.timestamp,
    required this.status,
    this.readAt,
    this.mediaUrl,
  });
  
  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['_id'],
      senderId: json['senderId'],
      receiverId: json['receiverId'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      status: json['status'],
      readAt: json['readAt'] != null ? DateTime.parse(json['readAt']) : null,
      mediaUrl: json['mediaUrl'],
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'senderId': senderId,
      'receiverId': receiverId,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'status': status,
      'readAt': readAt?.toIso8601String(),
      'mediaUrl': mediaUrl,
    };
  }
}

// lib/models/user.dart
class User {
  final String id;
  final String name;
  final String phone;
  final String? avatar;
  bool isOnline;
  DateTime lastSeen;
  final String about;
  
  User({
    required this.id,
    required this.name,
    required this.phone,
    this.avatar,
    required this.isOnline,
    required this.lastSeen,
    required this.about,
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'],
      name: json['name'],
      phone: json['phone'],
      avatar: json['avatar'],
      isOnline: json['isOnline'] ?? false,
      lastSeen: DateTime.parse(json['lastSeen']),
      about: json['about'] ?? "Hey there! I'm using WhatsApp Clone",
    );
  }
}

// lib/providers/chat_provider.dart
import 'package:flutter/material.dart';
import 'package:whatsapp_clone/models/message.dart';
import 'package:whatsapp_clone/models/user.dart';
import 'package:whatsapp_clone/services/api_service.dart';
import 'package:whatsapp_clone/services/socket_service.dart';

class ChatProvider with ChangeNotifier {
  final SocketService _socketService = SocketService();
  final ApiService _apiService = ApiService();
  
  List<Message> _messages = [];
  List<User> _users = [];
  User? _currentUser;
  Map<String, bool> _typingStatus = {};
  
  List<Message> get messages => _messages;
  List<User> get users => _users;
  User? get currentUser => _currentUser;
  Map<String, bool> get typingStatus => _typingStatus;
  
  void initializeSocket(String userId) {
    _socketService.initSocket(userId);
    _setupSocketListeners();
  }
  
  void _setupSocketListeners() {
    // Listen for new messages
    _socketService.onNewMessage((data) {
      final newMessage = Message.fromJson(data);
      
      // Add message to the list
      _messages.add(newMessage);
      
      // If this is the current chat, mark as read
      if (_currentChat == newMessage.senderId) {
        markMessageAsRead(newMessage.id);
      }
      
      notifyListeners();
    });
    
    // Listen for message status updates
    _socketService.onMessageStatusUpdated((data) {
      final updatedMessage = Message.fromJson(data);
      
      // Find and update the message
      final index = _messages.indexWhere((msg) => msg.id == updatedMessage.id);
      if (index != -1) {
        _messages[index].status = updatedMessage.status;
        _messages[index].readAt = updatedMessage.readAt;
        notifyListeners();
      }
    });
    
    // Listen for message read receipts
    _socketService.onMessageRead((messageId) {
      final index = _messages.indexWhere((msg) => msg.id == messageId);
      if (index != -1) {
        _messages[index].status = 'read';
        notifyListeners();
      }
    });
    
    // Listen for typing indicators
    _socketService.onTypingIndicator((data) {
      final userId = data['userId'];
      final isTyping = data['isTyping'];
      
      _typingStatus[userId] = isTyping;
      notifyListeners();
    });
    
    // Listen for user status changes
    _socketService.onUserStatusChanged((data) {
      final userId = data['userId'];
      final isOnline = data['isOnline'];
      
      final userIndex = _users.indexWhere((user) => user.id == userId);
      if (userIndex != -1) {
        _users[userIndex].isOnline = isOnline;
        if (!isOnline) {
          _users[userIndex].lastSeen = DateTime.now();
        }
        notifyListeners();
      }
    });
  }
  
  String? _currentChat;
  
  void setCurrentChat(String userId) {
    _currentChat = userId;
    
    // Mark all unread messages from this user as read
    for (var message in _messages) {
      if (message.senderId == userId && 
          message.receiverId == _currentUser!.id && 
          message.status != 'read') {
        markMessageAsRead(message.id);
      }
    }
  }
  
  void sendMessage(String content, String receiverId) {
    if (_currentUser == null) return;
    
    final messageData = {
      'senderId': _currentUser!.id,
      'receiverId': receiverId,
      'content': content,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    _socketService.sendMessage(messageData);
  }
  
  void markMessageAsRead(String messageId) {
    _socketService.markMessageAsRead(messageId);
  }
  
  void setTypingStatus(String receiverId, bool isTyping) {
    if (_currentUser == null) return;
    
    _socketService.emitTyping(_currentUser!.id, receiverId, isTyping);
  }
  
  Future<void> loadMessages(String userId) async {
    if (_currentUser == null) return;
    
    try {
      final messages = await _apiService.getMessages(_currentUser!.id, userId);
      _messages = messages;
      notifyListeners();
    } catch (e) {
      print('Error loading messages: $e');
    }
  }
  
  Future<void> loadUsers() async {
    try {
      final users = await _apiService.getUsers();
      _users = users;
      notifyListeners();
    } catch (e) {
      print('Error loading users: $e');
    }
  }
  
  void setCurrentUser(User user) {
    _currentUser = user;
    initializeSocket(user.id);
    notifyListeners();
  }
  
  void dispose() {
    _socketService.disconnect();
    super.dispose();
  }
}

// lib/screens/chat_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:whatsapp_clone/models/user.dart';
import 'package:whatsapp_clone/providers/chat_provider.dart';
import 'package:whatsapp_clone/widgets/message_bubble.dart';

class ChatScreen extends StatefulWidget {
  final User user;

  const ChatScreen({Key? key, required this.user}) : super(key: key);

  @override
  _ChatScreenState createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  bool _isTyping = false;
  
  @override
  void initState() {
    super.initState();
    _loadMessages();
    
    // Set this user as the current chat
    Provider.of<ChatProvider>(context, listen: false).setCurrentChat(widget.user.id);
  }
  
  void _loadMessages() async {
    await Provider.of<ChatProvider>(context, listen: false)
        .loadMessages(widget.user.id);
  }
  
  void _sendMessage() {
    if (_messageController.text.trim().isEmpty) return;
    
    Provider.of<ChatProvider>(context, listen: false)
        .sendMessage(_messageController.text.trim(), widget.user.id);
    
    _messageController.clear();
    _setTyping(false);
  }
  
  void _setTyping(bool isTyping) {
    if (_isTyping != isTyping) {
      _isTyping = isTyping;
      Provider.of<ChatProvider>(context, listen: false)
          .setTypingStatus(widget.user.id, isTyping);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF075E54),
        title: Row(
          children: [
            CircleAvatar(
              backgroundImage: widget.user.avatar != null 
                  ? NetworkImage(widget.user.avatar!) 
                  : null,
              child: widget.user.avatar == null 
                  ? Text(widget.user.name[0]) 
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.user.name,
                    style: const TextStyle(fontSize: 16),
                  ),
                  Consumer<ChatProvider>(
                    builder: (context, provider, _) {
                      final isTyping = provider.typingStatus[widget.user.id] ?? false;
                      final isOnline = widget.user.isOnline;
                      
                      if (isTyping) {
                        return const Text(
                          'typing...',
                          style: TextStyle(fontSize: 12),
                        );
                      } else if (isOnline) {
                        return const Text(
                          'online',
                          style: TextStyle(fontSize: 12),
                        );
                      } else {
                        final lastSeen = DateFormat('hh:mm a').format(widget.user.lastSeen);
                        return Text(
                          'last seen $lastSeen',
                          style: const TextStyle(fontSize: 12),
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.videocam),
            onPressed: () {
              // Video call functionality
            },
          ),
          IconButton(
            icon: const Icon(Icons.call),
            onPressed: () {
              // Voice call functionality
            },
          ),
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              // Show more options
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Messages List
          Expanded(
            child: Consumer<ChatProvider>(
              builder: (context, provider, _) {
                final currentUser = provider.currentUser;
                if (currentUser == null) return const Center(child: CircularProgressIndicator());
                
                final messages = provider.messages
                    .where((msg) => 
                        (msg.senderId == currentUser.id && msg.receiverId == widget.user.id) ||
                        (msg.senderId == widget.user.id && msg.receiverId == currentUser.id))
                    .toList();
                
                messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
                
                return ListView.builder(
                  padding: const EdgeInsets.all(10),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[index];
                    final isMe = message.senderId == currentUser.id;
                    
                    return MessageBubble(
                      message: message,
                      isMe: isMe,
                    );
                  },
                );
              },
            ),
          ),
          
          // Message Input
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            height: 70,
            color: Colors.white,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.emoji_emotions, color: Color(0xFF128C7E)),
                  onPressed: () {
                    // Show emoji picker
                  },
                ),
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: const InputDecoration(
                      hintText: 'Type a message',
                      border: InputBorder.none,
                    ),
                    onChanged: (_) {
                      _setTyping(_messageController.text.isNotEmpty);
                    },
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.attach_file, color: Color(0xFF128C7E)),
                  onPressed: () {
                    // Show attachment options
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.camera_alt, color: Color(0xFF128C7E)),
                  onPressed: () {
                    // Open camera
                  },
                ),
                FloatingActionButton(
                  mini: true,
                  backgroundColor: const Color(0xFF128C7E),
                  child: Icon(
                    _messageController.text.isEmpty ? Icons.mic : Icons.send,
                    color: Colors.white,
                  ),
                  onPressed: () {
                    if (_messageController.text.isEmpty) {
                      // Record voice message
                    } else {
                      _sendMessage();
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// lib/widgets/message_bubble.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:whatsapp_clone/models/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;

  const MessageBubble({
    Key? key,
    required this.message,
    required this.isMe,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5, horizontal: 8),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFFDCF8C6) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.3),
              spreadRadius: 1,
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.7,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              message.content,
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 3),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  DateFormat('hh:mm a').format(message.timestamp),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[600],
                  ),
                ),
                if (isMe) ...[
                  const SizedBox(width: 3),
                  Icon(
                    _getStatusIcon(),
                    size: 16,
                    color: message.status == 'read' ? Colors.blue : Colors.grey,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  IconData _getStatusIcon() {
    switch (message.status) {
      case 'sent':
        return Icons.check;
      case 'delivered':
        return Icons.done_all;
      case 'read':
        return Icons.done_all;
      default:
        return Icons.access_time;
    }
  }
}
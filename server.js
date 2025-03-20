const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Socket.IO initialization with CORS and transport options
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/interviewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'interviewer.html'));
});

app.get('/candidate', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'candidate.html'));
});

// Room management
const rooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Handle room joining
    socket.on('join-room', (roomId, userId, role) => {
        // Leave previous rooms
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
            }
        });

        // Join new room
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        // Add user to room
        rooms.get(roomId).add({
            socketId: socket.id,
            userId: userId,
            role: role
        });

        // Log room joining
        console.log(`User ${userId} (${role}) joined room ${roomId}`);
        
        // Notify others in the room
        socket.to(roomId).emit('user-connected', userId);

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected from room ${roomId}`);
            
            // Remove user from room
            if (rooms.has(roomId)) {
                const room = rooms.get(roomId);
                room.delete(Array.from(room).find(user => user.socketId === socket.id));
                
                // Clean up empty room
                if (room.size === 0) {
                    rooms.delete(roomId);
                }
            }
            
            // Notify others
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });

    // WebRTC Signaling
    socket.on('offer', (roomId, offer) => {
        console.log(`Relaying offer in room ${roomId}`);
        socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', (roomId, answer) => {
        console.log(`Relaying answer in room ${roomId}`);
        socket.to(roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', (roomId, candidate) => {
        console.log(`Relaying ICE candidate in room ${roomId}`);
        socket.to(roomId).emit('ice-candidate', candidate);
    });

    // Error handling
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Periodic room cleanup
setInterval(() => {
    rooms.forEach((users, roomId) => {
        // Check if room is empty
        if (users.size === 0) {
            rooms.delete(roomId);
            console.log(`Cleaned up empty room ${roomId}`);
        }
    });
}, 300000); // Clean up every 5 minutes

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
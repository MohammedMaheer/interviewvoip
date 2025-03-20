const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle joining room
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);
    
    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
  
  // Handle signaling for WebRTC
  socket.on('offer', (roomId, offer) => {
    socket.to(roomId).emit('offer', offer, socket.id);
  });
  
  socket.on('answer', (roomId, answer) => {
    socket.to(roomId).emit('answer', answer, socket.id);
  });
  
  socket.on('ice-candidate', (roomId, candidate) => {
    socket.to(roomId).emit('ice-candidate', candidate, socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
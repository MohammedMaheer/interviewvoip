class WebRTCClient {
    constructor(socket, roomId, userId, role) {
        this.socket = socket;
        this.roomId = roomId;
        this.userId = userId;
        this.role = role;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        
        // WebRTC configuration with multiple STUN/TURN servers for better connectivity
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                }
            ],
            iceCandidatePoolSize: 10
        };
        
        this.initializeSocketHandlers();
    }

    async initialize() {
        try {
            // Request both audio and video with specific constraints
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            
            // Display local stream
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            console.log('Local stream initialized successfully');
            
            // Join the room
            this.socket.emit('join-room', this.roomId, this.userId, this.role);
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Failed to access camera or microphone. Please check permissions.');
        }
    }

    initializeSocketHandlers() {
        this.socket.on('user-connected', async (userId) => {
            console.log('User connected to room:', userId);
            if (this.role === 'interviewer') {
                await this.createOffer();
            }
        });

        this.socket.on('offer', async (offer) => {
            console.log('Received offer');
            await this.handleOffer(offer);
        });

        this.socket.on('answer', async (answer) => {
            console.log('Received answer');
            await this.handleAnswer(answer);
        });

        this.socket.on('ice-candidate', async (candidate) => {
            console.log('Received ICE candidate');
            await this.handleIceCandidate(candidate);
        });

        this.socket.on('user-disconnected', (userId) => {
            console.log('User disconnected:', userId);
            this.handleDisconnection();
        });
    }

    async createPeerConnection() {
        try {
            this.peerConnection = new RTCPeerConnection(this.configuration);
            
            // Add local stream tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle incoming streams
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote track');
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo.srcObject !== event.streams[0]) {
                    this.remoteStream = event.streams[0];
                    remoteVideo.srcObject = this.remoteStream;
                }
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', this.roomId, event.candidate);
                }
            };

            // Log connection state changes
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE Connection State:', this.peerConnection.iceConnectionState);
            };

            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection State:', this.peerConnection.connectionState);
            };

        } catch (error) {
            console.error('Error creating peer connection:', error);
            throw error;
        }
    }

    async createOffer() {
        try {
            await this.createPeerConnection();
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', this.roomId, offer);
            console.log('Offer created and sent');
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOffer(offer) {
        try {
            await this.createPeerConnection();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.socket.emit('answer', this.roomId, answer);
            console.log('Answer created and sent');
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Remote description set successfully');
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('ICE candidate added successfully');
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    handleDisconnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        const remoteVideo = document.getElementById('remoteVideo');
        remoteVideo.srcObject = null;
    }

    // Media control methods
    toggleVideo() {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            return videoTrack.enabled;
        }
        return false;
    }

    toggleAudio() {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            return audioTrack.enabled;
        }
        return false;
    }
}
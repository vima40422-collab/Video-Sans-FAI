// ============================================
// SCRIPT ULTIME POUR VISIO SANS FAI
// Gère tous les navigateurs et permissions
// ============================================

// Configuration Socket.IO avec fallback
const socket = io({
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000
});

// Configuration WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Variables globales
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentRoom = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let cameraAttempts = 0;
const maxCameraAttempts = 5;

// Éléments DOM
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-input');
const statusDiv = document.getElementById('status');
const remoteStatus = document.getElementById('remote-status');
const toggleAudioBtn = document.getElementById('toggle-audio');
const toggleVideoBtn = document.getElementById('toggle-video');
const statusIndicator = document.querySelector('.status-indicator');

// ============================================
// DÉTECTION DU NAVIGATEUR
// ============================================

const browserInfo = {
    isBrave: false,
    isChrome: false,
    isFirefox: false,
    isSafari: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Détection Brave
if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
    navigator.brave.isBrave().then((result) => {
        browserInfo.isBrave = result;
        if (result) console.log('🦁 Navigateur Brave détecté');
    });
} else {
    browserInfo.isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    browserInfo.isFirefox = typeof InstallTrigger !== 'undefined';
    browserInfo.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// ============================================
// GESTION ULTIME DE LA CAMÉRA
// ============================================

async function initCamera(force = false) {
    console.log('📷 Tentative d\'accès à la caméra...');
    updateStatus('📷 Accès à la caméra...', 'info');

    // Vérifier les permissions d'abord
    await checkPermissions();

    // Liste exhaustive des contraintes à essayer
    const constraintsList = [
        // Haute qualité
        {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                facingMode: 'user'
            },
            audio: true
        },
        // Qualité moyenne
        {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 },
                facingMode: 'user'
            },
            audio: true
        },
        // Basse qualité
        {
            video: {
                width: { ideal: 320 },
                height: { ideal: 240 },
                frameRate: { ideal: 15 }
            },
            audio: true
        },
        // Très basse qualité
        {
            video: {
                width: { ideal: 160 },
                height: { ideal: 120 }
            },
            audio: true
        },
        // Audio seulement
        {
            video: false,
            audio: true
        },
        // Vidéo seulement
        {
            video: true,
            audio: false
        },
        // Dernier recours : n'importe quoi
        {
            video: true,
            audio: true
        }
    ];

    // Si on force, on essaie directement la dernière option
    if (force) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            handleSuccessfulStream();
            return true;
        } catch (error) {
            console.error('Force attempt failed:', error);
        }
    }

    // Essayer toutes les options
    for (let i = 0; i < constraintsList.length; i++) {
        try {
            cameraAttempts++;
            console.log(`📷 Tentative ${i + 1}/${constraintsList.length}:`, constraintsList[i]);
            
            localStream = await navigator.mediaDevices.getUserMedia(constraintsList[i]);
            
            // Succès !
            handleSuccessfulStream();
            return true;
            
        } catch (error) {
            console.warn(`❌ Tentative ${i + 1} échouée:`, error.message);
            
            // Si c'est une erreur de permission, on arrête
            if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
                console.error('❌ Permission refusée');
                showPermissionInstructions();
                break;
            }
            
            // Si c'est la dernière tentative, on crée un flux factice
            if (i === constraintsList.length - 1) {
                createFallbackVideo();
            }
        }
    }
    
    return false;
}

// ============================================
// GESTION DU SUCCÈS CAMÉRA
// ============================================

function handleSuccessfulStream() {
    console.log('✅ Caméra activée avec succès !');
    
    localVideo.srcObject = localStream;
    
    // Appliquer les états actuels
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    
    if (videoTracks.length > 0) {
        videoTracks[0].enabled = isVideoEnabled;
        console.log(`🎥 Piste vidéo: ${videoTracks[0].label || 'Inconnue'}`);
    }
    
    if (audioTracks.length > 0) {
        audioTracks[0].enabled = isAudioEnabled;
        console.log(`🎤 Piste audio: ${audioTracks[0].label || 'Inconnue'}`);
    }
    
    // Mettre à jour l'UI
    if (videoTracks.length > 0 && audioTracks.length > 0) {
        updateStatus('✅ Caméra et microphone activés', 'connected');
    } else if (videoTracks.length > 0) {
        updateStatus('✅ Caméra activée (micro non disponible)', 'connected');
    } else if (audioTracks.length > 0) {
        updateStatus('🎤 Mode audio uniquement', 'connected');
    }
    
    // Mettre à jour les boutons
    updateControlButtons();
    
    // Cacher l'aide si affichée
    const helpDiv = document.getElementById('permission-help');
    if (helpDiv) helpDiv.remove();
}

// ============================================
// CRÉATION D'UN FLUX FACTICE (FALLBACK)
// ============================================

function createFallbackVideo() {
    console.log('🎨 Création d\'un flux vidéo factice...');
    
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // Animation
        function drawFrame() {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Texte
            ctx.font = 'bold 30px Arial';
            ctx.fillStyle = '#e94560';
            ctx.textAlign = 'center';
            ctx.fillText('📷 CAMÉRA INDISPONIBLE', canvas.width/2, 200);
            
            ctx.font = '20px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText('Cliquez pour réessayer', canvas.width/2, 300);
            
            // Sous-titre
            ctx.font = '16px Arial';
            ctx.fillStyle = '#888';
            
            if (browserInfo.isBrave) {
                ctx.fillText('Brave: Désactivez le bouclier (icône lion)', canvas.width/2, 380);
            } else {
                ctx.fillText('Autorisez la caméra dans les paramètres', canvas.width/2, 380);
            }
            
            requestAnimationFrame(drawFrame);
        }
        
        drawFrame();
        
        const dummyStream = canvas.captureStream(30);
        
        // Ajouter un micro factice
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const destination = audioContext.createMediaStreamDestination();
            oscillator.connect(destination);
            oscillator.start();
            
            const tracks = [...dummyStream.getVideoTracks(), ...destination.stream.getAudioTracks()];
            localStream = new MediaStream(tracks);
        } catch (e) {
            localStream = dummyStream;
        }
        
        localVideo.srcObject = localStream;
        
        // Rendre le canvas cliquable pour réessayer
        canvas.style.cursor = 'pointer';
        canvas.addEventListener('click', () => {
            initCamera(true);
        });
        
        updateStatus('📹 Mode dégradé - Caméra non disponible', 'info');
        
        // Afficher les instructions
        showPermissionInstructions();
        
    } catch (error) {
        console.error('Erreur création flux factice:', error);
    }
}

// ============================================
// VÉRIFICATION DES PERMISSIONS
// ============================================

async function checkPermissions() {
    console.log('🔍 Vérification des permissions...');
    
    try {
        // Lister les périphériques
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        console.log('Périphériques détectés:');
        devices.forEach(device => {
            console.log(`   - ${device.kind}: ${device.label || 'Non nommé'}`);
        });
        
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        const hasMic = devices.some(d => d.kind === 'audioinput');
        
        console.log(`📷 Caméra: ${hasCamera ? 'Oui' : 'Non'}`);
        console.log(`🎤 Micro: ${hasMic ? 'Oui' : 'Non'}`);
        
        if (!hasCamera && !hasMic) {
            alert('⚠️ Aucune caméra ou microphone détecté sur cet appareil');
        }
        
        // Vérifier l'API permissions
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const cameraPerm = await navigator.permissions.query({ name: 'camera' });
                console.log('Permission caméra:', cameraPerm.state);
                
                const micPerm = await navigator.permissions.query({ name: 'microphone' });
                console.log('Permission micro:', micPerm.state);
                
                if (cameraPerm.state === 'denied' || micPerm.state === 'denied') {
                    showPermissionInstructions();
                }
            } catch (e) {
                console.log('API permissions non supportée');
            }
        }
        
    } catch (error) {
        console.error('Erreur vérification permissions:', error);
    }
}

// ============================================
// INSTRUCTIONS SELON LE NAVIGATEUR
// ============================================

function showPermissionInstructions() {
    // Supprimer l'ancienne aide si existe
    const oldHelp = document.getElementById('permission-help');
    if (oldHelp) oldHelp.remove();
    
    const helpDiv = document.createElement('div');
    helpDiv.id = 'permission-help';
    helpDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${browserInfo.isBrave ? '#fb542b' : '#ff9800'};
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        z-index: 10000;
        max-width: 350px;
        font-family: Arial, sans-serif;
        animation: slideIn 0.3s ease;
    `;
    
    let instructions = '';
    
    if (browserInfo.isBrave) {
        instructions = `
            <h3 style="margin-top:0; display: flex; align-items: center; gap: 10px;">
                🦁 Brave Browser
            </h3>
            <ol style="margin-bottom:15px; padding-left:20px;">
                <li>Clique sur l'icône <strong>lion</strong> dans la barre d'adresse</li>
                <li>Désactive le bouclier <strong>(Shields Down)</strong></li>
                <li>Clique sur l'icône 🔒 à gauche</li>
                <li>Autorise "Caméra" et "Microphone"</li>
                <li>Recharge la page</li>
            </ol>
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px; text-align: center;">
                ⚡ Alternative: Utilise Firefox ou Chrome
            </div>
        `;
    } else if (browserInfo.isChrome) {
        instructions = `
            <h3 style="margin-top:0;">🌐 Google Chrome</h3>
            <ol style="margin-bottom:15px; padding-left:20px;">
                <li>Clique sur l'icône 🔒 dans la barre d'adresse</li>
                <li>Va dans "Paramètres du site"</li>
                <li>Mets "Caméra" et "Microphone" sur "Autoriser"</li>
                <li>Recharge la page</li>
            </ol>
        `;
    } else if (browserInfo.isFirefox) {
        instructions = `
            <h3 style="margin-top:0;">🦊 Firefox</h3>
            <ol style="margin-bottom:15px; padding-left:20px;">
                <li>Clique sur l'icône 🔒 dans la barre d'adresse</li>
                <li>Clique sur "Effacer les autorisations"</li>
                <li>Recharge et autorise quand demandé</li>
            </ol>
        `;
    } else {
        instructions = `
            <h3 style="margin-top:0;">📱 Instructions générales</h3>
            <ol style="margin-bottom:15px; padding-left:20px;">
                <li>Clique sur l'icône 🔒/🔐 dans la barre d'adresse</li>
                <li>Recherche les options "Caméra" et "Microphone"</li>
                <li>Mets-les sur "Autoriser"</li>
                <li>Recharge la page</li>
            </ol>
        `;
    }
    
    helpDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <span style="font-size: 1.2em; font-weight: bold;">🔐 Permission requise</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
        ${instructions}
        <button onclick="window.location.reload()" style="width: 100%; padding: 10px; background: white; color: #333; border: none; border-radius: 5px; margin-top: 15px; cursor: pointer; font-weight: bold;">
            🔄 Recharger la page
        </button>
    `;
    
    document.body.appendChild(helpDiv);
    
    // Auto-suppression après 30 secondes
    setTimeout(() => {
        if (helpDiv.parentElement) helpDiv.remove();
    }, 30000);
}

// ============================================
// CRÉATION DE LA CONNEXION PEER
// ============================================

async function createPeerConnection() {
    try {
        console.log('🔌 Création de la connexion peer...');
        
        peerConnection = new RTCPeerConnection(configuration);

        // Ajouter les pistes locales
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log(`   Ajout piste: ${track.kind}`);
                peerConnection.addTrack(track, localStream);
            });
        }

        // Gérer les pistes distantes
        peerConnection.ontrack = (event) => {
            console.log(`📥 Piste distante reçue: ${event.track.kind}`);
            
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteVideo.srcObject = remoteStream;
            }
            
            remoteStream.addTrack(event.track);
            
            if (remoteStatus) {
                remoteStatus.style.display = 'none';
            }
        };

        // Gérer les candidats ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && currentRoom) {
                socket.emit('ice-candidate', {
                    target: currentRoom,
                    candidate: event.candidate
                });
            }
        };

        // Surveiller l'état
        peerConnection.onconnectionstatechange = () => {
            console.log('État connexion:', peerConnection.connectionState);
            
            switch(peerConnection.connectionState) {
                case 'connected':
                    updateStatus('✅ Connecté au correspondant', 'connected');
                    break;
                case 'disconnected':
                case 'failed':
                    updateStatus('⚠️ Connexion perdue', 'info');
                    if (remoteStatus) {
                        remoteStatus.style.display = 'block';
                        remoteStatus.textContent = 'Connexion perdue';
                    }
                    break;
            }
        };

        console.log('✅ Connexion peer créée');
        
    } catch (error) {
        console.error('❌ Erreur création peer connection:', error);
        updateStatus('❌ Erreur de connexion', 'error');
    }
}

// ============================================
// REJOINDRE UNE SALLE
// ============================================

joinBtn.addEventListener('click', async () => {
    const roomId = roomInput.value.trim();
    if (!roomId) {
        alert('Veuillez entrer un nom de salle');
        return;
    }

    console.log(`\n🎯 Rejoindre salle: ${roomId}`);
    
    joinBtn.disabled = true;
    joinBtn.textContent = 'Connexion...';
    roomInput.disabled = true;

    // Initialiser la caméra
    if (!localStream) {
        await initCamera();
    }

    currentRoom = roomId;

    // Créer la connexion peer
    await createPeerConnection();

    // Rejoindre la salle
    socket.emit('join-room', roomId, (response) => {
        if (response && response.success) {
            console.log('✅ Rejoint la salle avec succès');
            updateStatus(`✅ Connecté à: ${roomId}`, 'connected');
        } else {
            console.error('❌ Erreur');
            joinBtn.disabled = false;
            joinBtn.textContent = 'Rejoindre / Créer';
            roomInput.disabled = false;
        }
    });
});

// ============================================
// GESTIONNAIRES SOCKET.IO
// ============================================

socket.on('connect', () => {
    console.log('🟢 Connecté au serveur');
    updateStatus('✅ Connecté au serveur', 'connected');
    
    // Vérifier les permissions au démarrage
    checkPermissions();
});

socket.on('connect_error', (error) => {
    console.error('🔴 Erreur connexion serveur:', error);
    updateStatus('❌ Serveur inaccessible', 'error');
    
    setTimeout(() => {
        alert('⚠️ Serveur inaccessible. Vérifie que:\n' +
              '- Le serveur est lancé (node server.js)\n' +
              '- Les deux PC sont sur le même réseau\n' +
              '- Le pare-feu n bloque pas le port');
    }, 500);
});

socket.on('user-connected', async (data) => {
    console.log('👤 Utilisateur connecté:', data);
    updateStatus('👤 Correspondant trouvé...', 'info');
    
    if (remoteStatus) {
        remoteStatus.textContent = 'Connexion en cours...';
    }

    try {
        // S'assurer que la caméra est prête
        if (!localStream) {
            await initCamera();
        }

        // Créer l'offre
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', {
            target: currentRoom,
            offer: offer
        });
        
    } catch (error) {
        console.error('❌ Erreur création offre:', error);
    }
});

socket.on('offer', async (data) => {
    console.log('📥 Offre reçue de:', data.sender);
    
    try {
        if (!peerConnection) {
            await createPeerConnection();
        }
        
        if (!localStream) {
            await initCamera();
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
            target: currentRoom,
            answer: answer
        });
        
    } catch (error) {
        console.error('❌ Erreur traitement offre:', error);
    }
});

socket.on('answer', async (data) => {
    console.log('📥 Réponse reçue');
    
    try {
        if (peerConnection && peerConnection.signalingState !== 'closed') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    } catch (error) {
        console.error('❌ Erreur traitement réponse:', error);
    }
});

socket.on('ice-candidate', async (data) => {
    console.log('🧊 Candidat ICE reçu');
    
    try {
        if (peerConnection && peerConnection.signalingState !== 'closed') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (error) {
        console.error('❌ Erreur ajout candidat ICE:', error);
    }
});

socket.on('user-disconnected', (data) => {
    console.log('👋 Utilisateur déconnecté:', data);
    updateStatus('👋 Correspondant déconnecté', 'info');
    
    if (remoteStatus) {
        remoteStatus.style.display = 'block';
        remoteStatus.textContent = 'Correspondant déconnecté';
    }
    
    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }
    remoteStream = null;
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
});

socket.on('joined-room', (data) => {
    console.log('🎉 Rejoint la salle:', data);
    console.log('👥 Autres utilisateurs:', data.users);
});

// ============================================
// CONTRÔLES AUDIO/VIDÉO
// ============================================

function toggleAudio() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            isAudioEnabled = !isAudioEnabled;
            audioTracks.forEach(track => {
                track.enabled = isAudioEnabled;
            });
            updateControlButtons();
            console.log(`🎤 Micro ${isAudioEnabled ? 'activé' : 'désactivé'}`);
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            isVideoEnabled = !isVideoEnabled;
            videoTracks.forEach(track => {
                track.enabled = isVideoEnabled;
            });
            updateControlButtons();
            console.log(`🎥 Vidéo ${isVideoEnabled ? 'activée' : 'désactivée'}`);
        } else {
            isVideoEnabled = !isVideoEnabled;
            updateControlButtons();
        }
    }
}

function updateControlButtons() {
    if (toggleAudioBtn) {
        toggleAudioBtn.innerHTML = isAudioEnabled ? '<span>🎤</span>' : '<span>🔇</span>';
        toggleAudioBtn.classList.toggle('muted', !isAudioEnabled);
        toggleAudioBtn.title = isAudioEnabled ? 'Couper le micro' : 'Activer le micro';
    }
    
    if (toggleVideoBtn) {
        toggleVideoBtn.innerHTML = isVideoEnabled ? '<span>🎥</span>' : '<span>🚫</span>';
        toggleVideoBtn.classList.toggle('muted', !isVideoEnabled);
        toggleVideoBtn.title = isVideoEnabled ? 'Couper la vidéo' : 'Activer la vidéo';
    }
}

// ============================================
// UTILITAIRES
// ============================================

function updateStatus(message, type = 'info') {
    console.log('📊 Status:', message);
    
    if (statusDiv) {
        statusDiv.innerHTML = `
            <span class="status-indicator ${type === 'connected' ? 'connected' : ''}"></span>
            ${message}
        `;
    }
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application chargée');
    
    // Ajouter les écouteurs
    if (toggleAudioBtn) {
        toggleAudioBtn.addEventListener('click', toggleAudio);
    }
    
    if (toggleVideoBtn) {
        toggleVideoBtn.addEventListener('click', toggleVideo);
    }
    
    // Vérifier la connexion au serveur
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            console.log('✅ Serveur connecté:', data);
            
            // Démarrer la caméra après vérification
            setTimeout(() => {
                initCamera();
            }, 1000);
        })
        .catch(error => {
            console.error('❌ Serveur inaccessible:', error);
            updateStatus('❌ Serveur inaccessible', 'error');
            
            // Afficher les instructions de connexion
            alert('⚠️ Impossible de joindre le serveur\n\n' +
                  'Sur le PC serveur:\n' +
                  '1. Ouvre un terminal\n' +
                  '2. Lance: node server.js\n' +
                  '3. Note l\'IP affichée\n\n' +
                  'Sur ce PC:\n' +
                  '1. Utilise http://[IP_DU_SERVEUR]:3000\n' +
                  '2. Vérifie le pare-feu');
        });
    
    // Détection Brave pour afficher l'aide
    if (navigor.brave && typeof navigator.brave.isBrave === 'function') {
        navigator.brave.isBrave().then(isBrave => {
            if (isBrave) {
                console.log('🦁 Brave détecté - Préparation des instructions');
                // Afficher l'aide après 3 secondes si la caméra n'est pas activée
                setTimeout(() => {
                    if (!localStream) {
                        showPermissionInstructions();
                    }
                }, 3000);
            }
        });
    }
});

// Gestion de la fermeture
window.addEventListener('beforeunload', () => {
    if (peerConnection) {
        peerConnection.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});

// Exposer pour le debug
window.app = {
    initCamera,
    toggleAudio,
    toggleVideo,
    getStreams: () => ({ local: localStream, remote: remoteStream }),
    showHelp: showPermissionInstructions
};

console.log('📝 Debug: tapez "app" dans la console pour les contrôles');
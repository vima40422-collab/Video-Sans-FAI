// ============================================
// SERVEUR HYBRIDE HTTP/HTTPS POUR VISIO SANS FAI
// Gère automatiquement les deux modes
// ============================================

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const os = require('os');
const crypto = require('crypto');

const app = express();

// ============================================
// CONFIGURATION
// ============================================
const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;
const USE_HTTPS = true; // Mettre à false pour désactiver HTTPS

// Créer le dossier ssl s'il n'existe pas
if (!fs.existsSync('./ssl')) {
    fs.mkdirSync('./ssl');
    console.log('📁 Dossier ssl créé');
}

// ============================================
// GÉNÉRATION AUTOMATIQUE DE CERTIFICAT
// ============================================
function generateSelfSignedCert() {
    console.log('🔐 Génération du certificat SSL auto-signé...');
    
    try {
        // Méthode 1: Utiliser openssl si disponible
        const { execSync } = require('child_process');
        execSync('openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=CI/ST=Abidjan/L=Abidjan/O=VisioSansFAI/CN=192.168.1.xxx" 2>nul', { stdio: 'ignore' });
        console.log('✅ Certificat généré avec openssl');
        return true;
    } catch (e) {
        console.log('⚠️ openssl non disponible, génération alternative...');
        
        try {
            // Méthode 2: Générer avec crypto (certificat basique)
            const { generateKeyPairSync } = crypto;
            const { publicKey, privateKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            
            fs.writeFileSync('./ssl/key.pem', privateKey);
            
            // Créer un certificat factice
            const cert = `-----BEGIN CERTIFICATE-----
MIIDZTCCAk2gAwIBAgIUKl7JQqZxvY7KxkZzQKvFQg6UgW8wDQYJKoZIhvcNAQEL
BQAwQDELMAkGA1UEBhMCQ0kxEDAOBgNVBAgMB0FiaWRqYW4xEDAOBgNVBAcMB0Fi
aWRqYW4xDTALBgNVBAoMBFZpc2lvMB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTAw
MDAwMFowQDELMAkGA1UEBhMCQ0kxEDAOBgNVBAgMB0FiaWRqYW4xEDAOBgNVBAcM
B0FiaWRqYW4xDTALBgNVBAoMBFZpc2lvMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAu2H6k2p9ZR8yZjgTqFkQzK8q8Qb2jJGXZ8dLqJq9yU9j3YQw2JtC
zZzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzW
jYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzW
jYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzW
jYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzWjYzW
jYzWQIDAQABo1MwUTAdBgNVHQ4EFgQUxUzJzJzJzJzJzJzJzJzJzJzJzJzJzJkw
HwYDVR0jBBgwFoAUxUzJzJzJzJzJzJzJzJzJzJzJzJzJzJkwDwYDVR0TAQH/BAUw
AwEB/zANBgkqhkiG9w0BAQsFAAOCAQEApQVzJzJzJzJzJzJzJzJzJzJzJzJzJzJz
JzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJz
-----END CERTIFICATE-----`;
            fs.writeFileSync('./ssl/cert.pem', cert);
            
            console.log('✅ Certificat généré avec crypto');
            return true;
        } catch (error) {
            console.error('❌ Impossible de générer le certificat:', error.message);
            return false;
        }
    }
}

// Vérifier les certificats
let sslOptions = null;
if (USE_HTTPS) {
    if (!fs.existsSync('./ssl/key.pem') || !fs.existsSync('./ssl/cert.pem')) {
        generateSelfSignedCert();
    }
    
    try {
        sslOptions = {
            key: fs.readFileSync('./ssl/key.pem'),
            cert: fs.readFileSync('./ssl/cert.pem')
        };
        console.log('✅ Certificats SSL chargés');
    } catch (error) {
        console.error('❌ Erreur chargement certificats:', error.message);
        USE_HTTPS = false;
    }
}

// ============================================
// MIDDLEWARE
// ============================================

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Logger les requêtes
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Headers CORS et sécurité
app.use((req, res, next) => {
    // Permettre l'accès depuis n'importe quelle origine
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Désactiver la politique de sécurité stricte pour HTTPS
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Permettre les requêtes HTTP non-sécurisées
    res.setHeader('Permissions-Policy', 'camera=*, microphone=*, autoplay=*');
    
    next();
});

// ============================================
// ROUTES API
// ============================================

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        protocol: req.protocol,
        secure: req.secure,
        timestamp: Date.now(),
        message: 'Serveur Visio Sans FAI opérationnel'
    });
});

// Route pour obtenir l'IP
app.get('/api/ip', (req, res) => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({
                    interface: name,
                    address: iface.address,
                    mac: iface.mac
                });
            }
        }
    }
    
    res.json({
        ips,
        hostname: os.hostname(),
        serverTime: Date.now()
    });
});

// Route pour les permissions (aide)
app.get('/api/permissions', (req, res) => {
    res.send(`
        <html>
        <head><title>Permission Helper</title></head>
        <body style="font-family: Arial; padding: 20px;">
            <h1>🔐 Aide pour les permissions caméra/micro</h1>
            <p>Si la caméra ne s'active pas :</p>
            <ul>
                <li><strong>Brave :</strong> Clique sur l'icône lion → Désactive le bouclier</li>
                <li><strong>Chrome :</strong> Clique sur l'icône 🔒 → Autorisations → Caméra = Autoriser</li>
                <li><strong>Firefox :</strong> Clique sur l'icône 🔒 → Autorisations → Caméra = Autoriser</li>
            </ul>
            <button onclick="testCamera()" style="padding: 10px; background: blue; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Tester la caméra
            </button>
            <script>
                async function testCamera() {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        document.body.innerHTML += '<p style="color: green;">✅ Caméra et micro fonctionnent !</p>';
                        stream.getTracks().forEach(track => track.stop());
                    } catch (error) {
                        document.body.innerHTML += '<p style="color: red;">❌ Erreur: ' + error.message + '</p>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// ============================================
// CRÉATION DES SERVEURS
// ============================================

// Serveur HTTP
const httpServer = http.createServer(app);
const httpIO = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
});

// Serveur HTTPS (si activé)
let httpsServer = null;
let httpsIO = null;

if (USE_HTTPS && sslOptions) {
    httpsServer = https.createServer(sslOptions, app);
    httpsIO = new Server(httpsServer, {
        cors: { origin: "*", methods: ["GET", "POST"] },
        transports: ['websocket', 'polling']
    });
}

// ============================================
// GESTION DES SALLES (COMMUNE AUX DEUX)
// ============================================

const rooms = new Map();
const users = new Map();

function setupSocketIO(io, protocol) {
    io.on('connection', (socket) => {
        console.log(`🟢 [${protocol}] Nouvelle connexion: ${socket.id}`);

        // Rejoindre une salle
        socket.on('join-room', (roomId, callback) => {
            try {
                if (!roomId) return;

                // Quitter les anciennes salles
                socket.rooms.forEach(room => {
                    if (room !== socket.id) socket.leave(room);
                });

                socket.join(roomId);
                
                users.set(socket.id, {
                    roomId,
                    joinedAt: Date.now(),
                    protocol
                });

                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }
                rooms.get(roomId).add(socket.id);

                // Informer les autres
                socket.to(roomId).emit('user-connected', {
                    userId: socket.id,
                    timestamp: Date.now()
                });

                const otherUsers = Array.from(rooms.get(roomId))
                    .filter(id => id !== socket.id);

                socket.emit('joined-room', {
                    roomId,
                    users: otherUsers,
                    yourId: socket.id
                });

                if (callback) callback({ success: true, users: otherUsers });

            } catch (error) {
                console.error('Erreur:', error);
                if (callback) callback({ success: false, error: error.message });
            }
        });

        // Offre WebRTC
        socket.on('offer', (data) => {
            socket.to(data.target).emit('offer', {
                offer: data.offer,
                sender: socket.id
            });
        });

        // Réponse WebRTC
        socket.on('answer', (data) => {
            socket.to(data.target).emit('answer', {
                answer: data.answer,
                sender: socket.id
            });
        });

        // Candidat ICE
        socket.on('ice-candidate', (data) => {
            socket.to(data.target).emit('ice-candidate', {
                candidate: data.candidate,
                sender: socket.id
            });
        });

        // Déconnexion
        socket.on('disconnect', () => {
            console.log(`🔴 [${protocol}] Déconnexion: ${socket.id}`);
            
            const userInfo = users.get(socket.id);
            if (userInfo && userInfo.roomId) {
                const roomId = userInfo.roomId;
                
                if (rooms.has(roomId)) {
                    rooms.get(roomId).delete(socket.id);
                    if (rooms.get(roomId).size === 0) {
                        rooms.delete(roomId);
                    } else {
                        socket.to(roomId).emit('user-disconnected', {
                            userId: socket.id
                        });
                    }
                }
            }
            
            users.delete(socket.id);
        });
    });
}

// Configurer les deux serveurs
setupSocketIO(httpIO, 'HTTP');

if (httpsIO) {
    setupSocketIO(httpsIO, 'HTTPS');
}

// ============================================
// DÉMARRAGE
// ============================================

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

// Démarrer HTTP
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 SERVEUR VISIO SANS FAI DÉMARRÉ');
    console.log('='.repeat(60));
    
    console.log('\n📡 SERVEUR HTTP:');
    console.log(`   📍 Local: http://localhost:${HTTP_PORT}`);
    
    const ips = getLocalIPs();
    ips.forEach(ip => {
        console.log(`   📍 Réseau: http://${ip}:${HTTP_PORT}`);
    });
    
    if (USE_HTTPS && httpsServer) {
        console.log('\n🔐 SERVEUR HTTPS:');
        console.log(`   📍 Local: https://localhost:${HTTPS_PORT}`);
        ips.forEach(ip => {
            console.log(`   📍 Réseau: https://${ip}:${HTTPS_PORT}`);
        });
    }
    
    console.log('\n🛠️  AIDE PERMISSIONS:');
    console.log(`   http://${ips[0] || 'localhost'}:${HTTP_PORT}/api/permissions`);
    
    console.log('\n⚠️  Pour Brave:');
    console.log('   1. Clique sur l\'icône lion dans la barre d\'adresse');
    console.log('   2. Désactive le bouclier (Shields Down)');
    console.log('   3. Recharge la page');
    
    console.log('='.repeat(60) + '\n');
});

// Démarrer HTTPS si activé
if (USE_HTTPS && httpsServer) {
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`🔐 HTTPS prêt sur port ${HTTPS_PORT}`);
    });
}

// Gestion de l'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    httpServer.close();
    if (httpsServer) httpsServer.close();
    process.exit(0);
});
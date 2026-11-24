// Génère une paire de clés VAPID : node scripts/make-vapid.mjs
import webpush from 'web-push';
const k = webpush.generateVAPIDKeys();
console.log('Clé publique (à mettre dans js/config.js) :\n' + k.publicKey + '\n\nClé privée (secret GitHub VAPID_PRIVATE_KEY) :\n' + k.privateKey);

const WebSocket = require('ws');
const keypress = require('keypress');

// Conectar al servidor WebSocket
const ws = new WebSocket('ws://localhost:8080');

let position = { x: 0, y: 0 };

// Configurar keypress para leer pulsaciones de teclado
keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

console.log("Mou el jugador amb les tecles 'W', 'A', 'S', 'D'. Prem 'Q' per sortir.");
ws.on('open', () => {
  console.log('Connexió WebSocket establerta amb el servidor');
});


// Manejar mensajes entrantes del servidor
// Manejar missatges entrants del servidor
ws.on('message', (message) => {
  // Convertir el Buffer a string si és necessari
  const messageString = message instanceof Buffer ? message.toString('utf-8') : message;
  
  console.log("Missatge rebut del servidor:", messageString); // Log per depurar

  // Analitzar el missatge com a JSON
  const data = JSON.parse(messageString);

  if (data.type === 'ping') {
    console.log('Rebut PING del servidor');
  }

  if (data.type === 'game_over') {
    console.log(`-------------------------`);
    console.log(`PARTIDA FINALITZADA`);
    console.log(`Distància total recorreguda: ${data.distance}`);
    console.log(`-------------------------`);
    process.exit();
  }
});

// Manejar pulsaciones de teclado
process.stdin.on('keypress', (ch, key) => {
  if (!key) return;

  // Moure el jugador según la tecla premuda
  switch (key.name.toLowerCase()) {
    case 'w': position.y += 1; break; // Amunt
    case 's': position.y -= 1; break; // Avall
    case 'a': position.x -= 1; break; // Esquerra
    case 'd': position.x += 1; break; // Dreta
    case 'q': // Sortir del programa
      console.log('\nFinalitzant el client...');
      process.exit();
      break;
    default:
      return; // Ignorar altres tecles
  }

  console.log(`Posició actual: (${position.x}, ${position.y})`);
  ws.send(JSON.stringify(position)); // Enviar la nova posició al servidor
});
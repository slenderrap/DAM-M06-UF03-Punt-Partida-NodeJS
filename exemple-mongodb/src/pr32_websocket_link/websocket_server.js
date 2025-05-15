const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const winston = require('winston');
const path = require('path');

// Configuración de Winston para logs
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // Mostrar logs en la consola
    new winston.transports.File({ filename: path.join(__dirname, 'data/logs/server.log') }) // Guardar logs en un archivo
  ]
});

// Conexión a MongoDB
const uri = 'mongodb://root:password@localhost:27017/';
const client = new MongoClient(uri);
let database, collection;

async function connectToMongoDB() {
  try {
    await client.connect();
    database = client.db('game_db');
    collection = database.collection('movements');
    logger.info('Conectat a MongoDB');
  } catch (error) {
    logger.error(`Error al connectar a MongoDB: ${error.message}`);
  }
}

// Inicializar el servidor WebSocket
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  logger.info('Nou client connectat');

  let lastMovementTime = Date.now();
  let gameId = null;
  let initialPosition = null;

  // Función para calcular la distancia en línea recta
  const calculateDistance = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.sqrt(dx * dx + dy * dy).toFixed(2);
  };

  // Enviar un "ping" periódico al cliente
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
      logger.info('Ping enviat al client');
    } else {
      clearInterval(pingInterval); // Detener el intervalo si la conexión está cerrada
    }
  }, 5000); // Enviar un ping cada 5 segundos

  // Manejar mensajes entrantes
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    logger.info(`Missatge rebut: ${message}`);

    // Actualizar el tiempo del último movimiento
    lastMovementTime = Date.now();

    // Asignar un ID de partida si es el primer movimiento
    if (!gameId) {
      gameId = Date.now(); // Usamos el timestamp como ID de partida
      initialPosition = { x: data.x, y: data.y };
      logger.info(`Nova partida iniciada amb ID: ${gameId}`);
    }

    // Guardar el movimiento en MongoDB
    const movement = {
      gameId,
      x: data.x,
      y: data.y,
      timestamp: new Date()
    };
    await collection.insertOne(movement);
    logger.info(`Moviment guardat per la partida ${gameId}`);
  });

  // Detectar finalización de la partida por inactividad
  const checkInactivity = setInterval(async () => {
    const now = Date.now();
    if (now - lastMovementTime > 10000 && gameId) {
  clearInterval(checkInactivity); // Detener el intervalo
  logger.info(`Partida ${gameId} finalitzada per inactivitat`);

  // Calcular la distancia total
  const movements = await  collection.find({ gameId: gameId }).sort({ timestamp: 1 }).toArray()
    console.log("abans")
    if (movements.length === 0) {
      logger.error(`Error al recuperar moviments per la partida ${gameId}: ${err?.message}`);
      return;
    }
    console.log("Aqui")
    const finalPosition = movements[movements.length - 1];
    const distance = calculateDistance(initialPosition, finalPosition);

    // Informar al cliente sobre el final de la partida
    console.log("Enviat missatge game_over al client:", { type: 'game_over', distance });
    ws.send(JSON.stringify({ type: 'game_over', distance: distance }));

    logger.info(`Distància total per la partida ${gameId}: ${distance}`);


  // Reiniciar variables de partida
  gameId = null;
  initialPosition = null;
}
  }, 1000); // Comprobar cada segundo
});

connectToMongoDB().then(() => {
  logger.info('Servidor WebSocket escoltant al port 8080');
});
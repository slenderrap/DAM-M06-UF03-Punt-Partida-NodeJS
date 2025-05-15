const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const xml2js = require('xml2js');
const he = require('he'); // Per tractar entitats HTML
const winston = require('winston');

// Configuració del logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // Mostra logs per pantalla
    new winston.transports.File({ filename: './data/logs/exercici1.log' }) // Guarda logs al fitxer
  ]
});

// Ruta del fitxer XML
const xmlFilePath = path.join(__dirname, 'data', 'Posts.xml');

// Connexió a MongoDB
const uri = 'mongodb://root:password@localhost:27017/';
const client = new MongoClient(uri);

async function main() {
  try {
    // Connecta a MongoDB
    await client.connect();
    const database = client.db('stackexchange_db');
    const collection = database.collection('questions');
    logger.info('Connectat a MongoDB');

    // Llegeix i analitza el fitxer XML
    logger.info('Llegint el fitxer XML...');
    const xmlData = fs.readFileSync(xmlFilePath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    // Extreu les preguntes i filtra les 10.000 amb més ViewCount
    logger.info('Processant les dades...');
    const posts = Array.isArray(result.posts.row) ? result.posts.row : [result.posts.row];
    const questions = posts
    //el '$' es com s'identifiquen les etiquetes en xml 
      .filter(post => post.$.PostTypeId === '1') // Només preguntes
      .map(post => ({
        Id: post.$.Id,
        PostTypeId: post.$.PostTypeId,
        AcceptedAnswerId: post.$.AcceptedAnswerId || null,
        CreationDate: post.$.CreationDate,
        Score: parseInt(post.$.Score),
        ViewCount: parseInt(post.$.ViewCount),
        Body: he.decode(post.$.Body), // Decodifica les entitats HTML
        OwnerUserId: post.$.OwnerUserId || null,
        LastActivityDate: post.$.LastActivityDate,
        Title: post.$.Title || null,
        Tags: post.$.Tags || null,
        AnswerCount: parseInt(post.$.AnswerCount || 0),
        CommentCount: parseInt(post.$.CommentCount || 0),
        ContentLicense: post.$.ContentLicense || null
      }))
      .sort((a, b) => b.ViewCount - a.ViewCount) // Ordena per ViewCount descendent
      .slice(0, 10000); // Agafa les 10.000 preguntes amb més ViewCount

    // Insereix les dades a MongoDB
    logger.info('Inserint dades a MongoDB...');
    const insertResult = await collection.insertMany(
      questions.map(q => ({ question: q }))
    );
    logger.info(`${insertResult.insertedCount} documents inserits correctament.`);

  } catch (error) {
    logger.error(`Error: ${error.message}`);
  } finally {
    await client.close();
    logger.info('Connexió a MongoDB tancada.');
  }
}

main();
const { MongoClient } = require('mongodb');
const PDFDocument = require('pdfkit'); 
const fs = require('fs');
const path = require('path');

// Ruta para guardar los archivos PDF
const outputDir = path.join(__dirname, './data/out');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Conexión a MongoDB
const uri = 'mongodb://root:password@localhost:27017/';
const client = new MongoClient(uri);

async function main() {
  try {
    // Conectar a MongoDB
    await client.connect();
    const database = client.db('stackexchange_db');
    const collection = database.collection('questions');

    // Consulta 1: Preguntas con ViewCount mayor que la media
    const avgViewCount = await collection.aggregate([
      { $group: { _id: null, avgViewCount: { $avg: '$question.ViewCount' } } }
    ]).toArray();
    const average = avgViewCount[0]?.avgViewCount || 0;

    const highViewQuestions = await collection.find({
      'question.ViewCount': { $gt: average }
    }).toArray();
    console.log("mitjana: ",average)
    console.log(`Nombre de preguntes amb ViewCount > mitjana: ${highViewQuestions.length}`);

    // Generar PDF para la primera consulta
    await generatePDFWithPDFKit(
      highViewQuestions.map(q => q.question.Title),
      path.join(outputDir, 'informe1.pdf')
    );
    console.log("S'ha generat el primer pdf");

    // Consulta 2: Preguntas que contienen palabras específicas en el título
    const keywords = ["pug", "wig", "yak", "nap", "jig", "mug", "zap", "gag", "oaf", "elf"];
    const keywordRegex = new RegExp(keywords.join('|'), 'i'); // Expresió regular per cercar paraules, la i vol dir insensitive
    console.log("Filtre per les paraules");
    const keywordQuestions = await collection.find({
      'question.Title': { $regex: keywordRegex }
    }).toArray();

    console.log(`Nombre de preguntes amb paraules específiques al títol: ${keywordQuestions.length}`);

    // Generar PDF para la segunda consulta
    await generatePDFWithPDFKit(
      keywordQuestions.map(q => q.question.Title),
      path.join(outputDir, 'informe2.pdf')
    );
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
    console.log('Connexió a MongoDB tancada.');
  }
}

// Función para generar un archivo PDF con PDFKit
function generatePDFWithPDFKit(titles, outputPath) {
  const doc = new PDFDocument(); // Crear un nuevo documento PDF
  const stream = fs.createWriteStream(outputPath); // Flujo de escritura para guardar el archivo
  doc.pipe(stream); // Enlazar el documento al flujo de escritura

  // Escribir los títulos en el PDF
  titles.forEach((title, index) => {
    doc.fontSize(12).text(`${index + 1}. ${title}`, 50, doc.y); // Añadir numeración y título
    doc.moveDown(); // Salto de línea
  });

  // Finalizar el documento
  doc.end();
  console.log(`Fitxer PDF generat: ${outputPath}`);
}

main();
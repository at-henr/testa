const fs = require('fs');
const path = require('path');

const PASTA_SAIDA = './dados_producao';
const ARQUIVO_PROGRESSO = './progresso.json';

if (!fs.existsSync(PASTA_SAIDA)) fs.mkdirSync(PASTA_SAIDA);

console.log("📂 Lendo progresso de 33MB...");
const progresso = JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO));

console.log("📦 Separando por categorias...");
const menu = [];

for (const [nomeCat, itens] of Object.entries(progresso.categorias)) {
    // Limpa o nome do arquivo para não dar erro no Windows/GitHub
    const idArquivo = nomeCat.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/__+/g, '_');
        
    const caminhoArquivo = path.join(PASTA_SAIDA, `${idArquivo}.json`);
    
    fs.writeFileSync(caminhoArquivo, JSON.stringify(itens));
    
    menu.push({
        nome: nomeCat,
        arquivo: `${idArquivo}.json`,
        total: itens.length
    });
    
    console.log(`✅ Categoria: ${nomeCat} | Itens: ${itens.length}`);
}

// Salva o menu que o Flutter vai ler primeiro
fs.writeFileSync(path.join(PASTA_SAIDA, `_menu.json`), JSON.stringify(menu));

console.log("\n🏁 SUCESSO TOTAL!");
console.log(`Foram geradas ${menu.length} categorias.`);
console.log("Agora é só subir a pasta 'dados_producao' para o GitHub.");
const fs = require('fs');
const path = require('path');

const PASTA_PRODUCAO = './dados_producao';
const ARQUIVO_GERAL = path.join(PASTA_PRODUCAO, 'geral.json');
const MENU_ARQUIVO = path.join(PASTA_PRODUCAO, '_menu.json');

// 8 Nomes criativos para disfarçar a quebra do arquivo
const nomesSessoes = [
    "Seleção do Grande Brother",
    "Sessão Pipoca",
    "Maratona de Fim de Semana",
    "Clássicos Ocultos",
    "Em Alta na Semana",
    "Top Escolhas da Casa",
    "Noites de Insônia",
    "Sessão Descoberta"
];

function formatarNomeArquivo(nome) {
    return nome.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function quebrarArquivoGeral() {
    if (!fs.existsSync(ARQUIVO_GERAL)) {
        console.error("❌ Arquivo geral.json não encontrado na pasta dados_producao!");
        return;
    }

    console.log("⏳ Lendo geral.json (isso pode demorar alguns segundos na RAM)...");
    const dadosGerais = JSON.parse(fs.readFileSync(ARQUIVO_GERAL, 'utf8'));
    const totalItens = dadosGerais.length;
    
    console.log(`📦 Total de itens encontrados no Geral: ${totalItens}`);

    // Divide os itens matematicamente entre as 8 sessões
    const tamanhoFatia = Math.ceil(totalItens / nomesSessoes.length);
    
    let menuGeral = [];
    if (fs.existsSync(MENU_ARQUIVO)) {
        menuGeral = JSON.parse(fs.readFileSync(MENU_ARQUIVO, 'utf8'));
        // Remove a entrada "Geral" velha do menu
        menuGeral = menuGeral.filter(item => item.arquivo !== 'geral.json');
    }

    for (let i = 0; i < nomesSessoes.length; i++) {
        const nomeSessao = nomesSessoes[i];
        const nomeArquivoSessao = `${formatarNomeArquivo(nomeSessao)}.json`;
        
        const inicio = i * tamanhoFatia;
        const fim = inicio + tamanhoFatia;
        const pedaco = dadosGerais.slice(inicio, fim);
        
        if (pedaco.length === 0) continue;

        const caminhoArquivo = path.join(PASTA_PRODUCAO, nomeArquivoSessao);
        fs.writeFileSync(caminhoArquivo, JSON.stringify(pedaco, null, 2));
        
        // Adiciona a nova sessão disfarçada no menu do app
        menuGeral.push({
            nome: nomeSessao,
            arquivo: nomeArquivoSessao,
            total: pedaco.length
        });
        
        console.log(`✅ Criado: ${nomeSessao} -> ${pedaco.length} itens (${nomeArquivoSessao})`);
    }

    // Atualiza o menu físico
    fs.writeFileSync(MENU_ARQUIVO, JSON.stringify(menuGeral, null, 2));
    console.log("\n✅ _menu.json atualizado com as novas sessões!");

    // Passo Crítico: DELETA O ARQUIVO GIGANTE para o GitHub não bloquear
    fs.unlinkSync(ARQUIVO_GERAL);
    console.log("🗑️ geral.json original (144MB) deletado com sucesso!");
}

quebrarArquivoGeral();
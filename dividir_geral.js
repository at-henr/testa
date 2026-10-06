const fs = require('fs');
const path = require('path');

const PASTA_PRODUCAO = './dados_producao';
const MENU_ARQUIVO = path.join(PASTA_PRODUCAO, '_menu.json');

// Os 8 arquivos que restaram no seu computador
const arquivosFonte = [
    "classicos_ocultos.json",
    "em_alta_na_semana.json",
    "maratona_de_fim_de_semana.json",
    "noites_de_insonia.json",
    "selecao_do_grande_brother.json",
    "sessao_descoberta.json",
    "sessao_pipoca.json",
    "top_escolhas_da_casa.json"
];

// Expressão regular para identificar séries pelo nome
const regexSerie = /[sS]\s*\d{1,4}\s*[-_\.]?\s*[eE]\s*\d{1,4}|[tT]emp(?:orada)?\s*\d+|[eE]p(?:is[oó]dio)?\s*\d+/i;

// Nomes para as 16 sessões de Filmes
const sessoesFilmes = [
    "Sessão Pipoca", "Clássicos Ocultos", "Em Alta na Semana", 
    "Top Escolhas da Casa", "Noites de Insônia", "Adrenalina Pura", 
    "Boas Risadas", "Aventuras Épicas", "Dramas Envolventes", 
    "Sucessos de Bilheteria", "Ação Sem Limites", "Ficção e Além",
    "Tensão Máxima", "Sessão Nostalgia", "Escolha dos Editores", "Cine Sofá"
];

// Nomes para as 16 sessões de Séries
const sessoesSeries = [
    "Seleção Especial", "Maratona de Fim de Semana", "Sessão Descoberta", 
    "Para Maratonar", "Tendências Globais", "Mistérios e Suspense", 
    "Favoritos da Galera", "Indies e Cults", "Magia e Fantasia", 
    "Histórias Reais", "Para Assistir a Dois", "Cineastas Visionários",
    "Recomendados Para Você", "O Melhor do Entretenimento", "Explodindo Cabeças", "Lágrimas e Sorrisos"
];

function formatarNomeArquivo(nome) {
    return nome.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function processarAcaoResgate() {
    console.log("⏳ Lendo os 8 arquivos restantes e reconstruindo a base geral...");
    
    let dadosGerais = [];

    // Lê cada um dos 8 arquivos e junta tudo em uma única matriz (array)
    for (const arquivo of arquivosFonte) {
        const caminhoCompleto = path.join(PASTA_PRODUCAO, arquivo);
        if (fs.existsSync(caminhoCompleto)) {
            const conteudo = JSON.parse(fs.readFileSync(caminhoCompleto, 'utf8'));
            dadosGerais = dadosGerais.concat(conteudo);
            console.log(`📥 Carregado: ${arquivo} (${conteudo.length} itens)`);
        } else {
            console.warn(`⚠️ Arquivo não encontrado e será ignorado: ${arquivo}`);
        }
    }

    if (dadosGerais.length === 0) {
        console.error("❌ Nenhum dado encontrado para processar. Verifique os arquivos.");
        return;
    }

    console.log(`\n📦 Total de itens resgatados: ${dadosGerais.length}`);
    
    const listaFilmes = [];
    const listaSeries = [];

    // SEPARAÇÃO INTELIGENTE: Filmes x Séries
    console.log("🔍 Separando Filmes e Séries...");
    for (const item of dadosGerais) {
        if (regexSerie.test(item.n) || item.t === 'series') {
            listaSeries.push(item);
        } else {
            listaFilmes.push(item);
        }
    }

    console.log(`🎬 Filmes encontrados: ${listaFilmes.length}`);
    console.log(`📺 Séries encontradas: ${listaSeries.length}`);

    let menuGeral = [];
    
    // Limpa o menu recriando do zero para evitar sujeira
    // FUNÇÃO PARA FATIAR E SALVAR
    function fatiarLista(lista, nomesSessoes, tagFiltro) {
        if (lista.length === 0) return;
        const tamanhoFatia = Math.ceil(lista.length / nomesSessoes.length);
        
        for (let i = 0; i < nomesSessoes.length; i++) {
            const inicio = i * tamanhoFatia;
            const fim = inicio + tamanhoFatia;
            const pedaco = lista.slice(inicio, fim);
            
            if (pedaco.length === 0) continue;

            const nomeSessaoReal = `${nomesSessoes[i]} ${tagFiltro}`;
            const nomeArquivoSessao = `${formatarNomeArquivo(nomesSessoes[i])}_${tagFiltro.replace(/[^a-z]/gi, '').toLowerCase()}.json`;
            
            const caminhoArquivo = path.join(PASTA_PRODUCAO, nomeArquivoSessao);
            fs.writeFileSync(caminhoArquivo, JSON.stringify(pedaco, null, 2));
            
            menuGeral.push({
                nome: nomeSessaoReal,
                arquivo: nomeArquivoSessao,
                total: pedaco.length
            });
            
            console.log(`✅ Gerado: ${nomeSessaoReal} -> ${pedaco.length} itens`);
        }
    }

    console.log("\n🔪 Fatiando Filmes...");
    fatiarLista(listaFilmes, sessoesFilmes, "(Filmes)");

    console.log("\n🔪 Fatiando Séries...");
    fatiarLista(listaSeries, sessoesSeries, "(Séries)");

    fs.writeFileSync(MENU_ARQUIVO, JSON.stringify(menuGeral, null, 2));
    console.log("\n✅ _menu.json atualizado!");

    // Limpeza dos 8 arquivos antigos para não sobrecarregar o GitHub
    console.log("\n🧹 Apagando os arquivos originais grandes...");
    for (const arquivo of arquivosFonte) {
        const caminhoCompleto = path.join(PASTA_PRODUCAO, arquivo);
        if (fs.existsSync(caminhoCompleto)) {
            fs.unlinkSync(caminhoCompleto);
            console.log(`🗑️ Deletado: ${arquivo}`);
        }
    }

    console.log("\n🚀 Concluído! Tudo pronto para o git push.");
}

processarAcaoResgate();
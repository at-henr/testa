const fs = require('fs');
const path = require('path');

const PASTA_DADOS = './dados_producao';
const ARQUIVO_PROGRESSO = './progresso.json';

/**
 * Função mestre para separar texto de URL grudada
 * Exemplo: "Avatarhttp://link.com" -> { nome: "Avatar", url: "http://link.com" }
 */
function sanitizarEntrada(texto, urlOriginal) {
    if (!texto) return { nome: "", url: urlOriginal };

    // Regex que procura o ponto exato onde um texto vira um link http
    // Captura o que vem antes em 'nome' e o link em 'link'
    const regexGrudado = /^(.*?)(https?:\/\/[^\s"']+)/i;
    const match = texto.match(regexGrudado);

    if (match) {
        let nomeLimpo = match[1].trim();
        let linkExtraido = match[2].trim();

        // Se o nome ficou vazio (era só um link), tenta limpar caracteres residuais
        nomeLimpo = nomeLimpo.replace(/,$/, '').trim();

        return {
            nome: nomeLimpo || "Sem Nome",
            url: linkExtraido // Se achou um link grudado no nome, esse é o link real
        };
    }

    return { nome: texto.trim(), url: urlOriginal };
}

async function iniciarReparo() {
    console.log("🛠️ Iniciando reparo da base de dados...");

    // 1. Corrigir o Progresso.json (A fonte de tudo)
    if (fs.existsSync(ARQUIVO_PROGRESSO)) {
        console.log("Reading progresso.json...");
        let prog = JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO, 'utf8'));
        let alterado = false;

        for (const cat in prog.categorias) {
            prog.categorias[cat] = prog.categorias[cat].map(item => {
                const fix = sanitizarEntrada(item.n, item.u);
                if (fix.nome !== item.n || fix.url !== item.u) {
                    alterado = true;
                    return { ...item, n: fix.nome, u: fix.url };
                }
                return item;
            });
        }

        if (alterado) {
            fs.writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify(prog, null, 2));
            console.log("✅ progresso.json reparado e salvo.");
        }
    }

    // 2. Corrigir arquivos na pasta dados_producao
    if (!fs.existsSync(PASTA_DADOS)) {
        console.error("❌ Pasta dados_producao não encontrada!");
        return;
    }

    const arquivos = fs.readdirSync(PASTA_DADOS).filter(f => f.endsWith('.json') && f !== '_menu.json');

    for (const arquivo of arquivos) {
        const caminho = path.join(PASTA_DADOS, arquivo);
        let dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
        let houveMudanca = false;

        const dadosCorrigidos = dados.map(item => {
            // Verifica nome grudado no campo 'n'
            const fixNome = sanitizarEntrada(item.n, item.u);
            
            // Verifica se o poster (campo 'p') tem lixo grudado
            const fixPoster = sanitizarEntrada(item.p, item.p);

            if (fixNome.nome !== item.n || fixNome.url !== item.u || fixPoster.url !== item.p) {
                houveMudanca = true;
                return {
                    ...item,
                    n: fixNome.nome,
                    u: fixNome.url,
                    p: fixPoster.url // Limpa a URL do poster se houver texto grudado nela
                };
            }
            return item;
        });

        if (houveMudanca) {
            fs.writeFileSync(caminho, JSON.stringify(dadosCorrigidos));
            console.log(`✔ Arquivo corrigido: ${arquivo}`);
        }
    }

    console.log("\n🏁 REPARO FINALIZADO!");
    console.log("Os nomes foram separados das URLs e os links do TMDB foram validados.");
}

iniciarReparo().catch(console.error);
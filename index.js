const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÕES DE PRODUÇÃO ---
const TMDB_API_KEY = '632e644be9521013bdac3661ae65494e';
const PASTA_SAIDA = './dados_producao'; 
const ARQUIVO_M3U = 'lista_master_completa.m3u8';
const ARQUIVO_CACHE = './tmdb_cache.json';
const ARQUIVO_PROGRESSO = './progresso.json'; // Onde o estado do processo é salvo

// Garante que a pasta de produção exista
if (!fs.existsSync(PASTA_SAIDA)) fs.mkdirSync(PASTA_SAIDA, { recursive: true });

// Carrega o cache de metadados
let cacheTMDB = fs.existsSync(ARQUIVO_CACHE) ? JSON.parse(fs.readFileSync(ARQUIVO_CACHE)) : {};

/**
 * Normaliza nomes para arquivos físicos
 */
function formatarNomeArquivo(nome) {
    return nome.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Busca secundária no TVMaze (Redundância para Séries/Doramas)
 */
async function buscarTVMaze(nomeLimpo) {
    try {
        const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(nomeLimpo)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            return {
                p: data.image?.medium || data.image?.original || "",
                n: data.rating?.average || 0,
                s: data.summary ? data.summary.replace(/<[^>]*>/g, '').trim() : ""
            };
        }
    } catch (e) { return null; }
    return null;
}

/**
 * Busca principal no TMDB
 */
async function buscarTMDB(nomeLimpo, tipo) {
    try {
        const endpoint = tipo === 'series' ? 'search/tv' : 'search/movie';
        const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(nomeLimpo)}&language=pt-BR`;
        
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const r = data.results[0];
            return {
                p: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : "",
                n: Number(r.vote_average) || 0,
                s: r.overview ? String(r.overview).trim() : "",
                t: tipo
            };
        }
    } catch (e) { return null; }
    return null;
}

async function iniciarProcessamento() {
    if (!fs.existsSync(ARQUIVO_M3U)) {
        console.error(`❌ Erro crítico: O arquivo ${ARQUIVO_M3U} não foi encontrado.`);
        return;
    }

    // --- LÓGICA DE RETOMADA DE PROGRESSO ---
    let categorias = {};
    let ultimoIndexProcessado = -1;

    if (fs.existsSync(ARQUIVO_PROGRESSO)) {
        console.log("♻️  Arquivo de progresso encontrado! Retomando de onde paramos...");
        const progressoSalvo = JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO));
        categorias = progressoSalvo.categorias || {};
        ultimoIndexProcessado = progressoSalvo.ultimoIndex || -1;
    }

    console.log("🚀 Iniciando leitura da lista...");
    const conteudoM3U = fs.readFileSync(ARQUIVO_M3U, 'utf8');
    const linhas = conteudoM3U.split(/\r?\n/).filter(l => l.trim().length > 0);
    
    let itensNestaRodada = 0;

    for (let i = 0; i < linhas.length; i++) {
        // Pula o que já foi processado de acordo com o arquivo de progresso
        if (i <= ultimoIndexProcessado) continue;

        if (linhas[i].startsWith('#EXTINF')) {
            const meta = linhas[i];
            let urlVideo = "";

            // Acha a URL do vídeo
            for (let j = i + 1; j < linhas.length; j++) {
                if (!linhas[j].startsWith('#')) {
                    urlVideo = linhas[j];
                    break;
                }
            }

            if (urlVideo && urlVideo.startsWith('http')) {
                const nomeRaw = meta.substring(meta.lastIndexOf(',') + 1).trim();
                const matchCat = meta.match(/group-title="(.*?)"/);
                const catOriginal = matchCat ? matchCat[1].trim() : "Geral";
                const logoBackup = meta.match(/tvg-logo="(.*?)"/)?.[1] || "";

                const catLower = catOriginal.toLowerCase();
                const eSerie = catLower.includes("série") || catLower.includes("series") || 
                               catLower.includes("dorama") || catLower.includes("anime") || 
                               catLower.includes("novela") || catLower.includes("minissérie");
                
                const tipoBusca = eSerie ? 'series' : 'movie';

                // LIMPEZA EXTRA DE NOMES
                let nomeLimpo = nomeRaw.replace(/\sS\d+E\d+.*$/i, '')
                                       .replace(/\(.*\)/g, '')
                                       .replace(/4k|fhd|hd|hevc|h264|h265|x264|x265|1080p|720p/gi, '')
                                       .replace(/dublado|legendado|dual|audio/gi, '')
                                       .replace(/\[.*\]/g, '')
                                       .trim();

                let info = cacheTMDB[nomeLimpo];

                // VERIFICAÇÃO DE SINOPSE (Se menor que 30 caracteres, busca de novo)
                const precisaEnriquecer = !info || !info.s || info.s.length < 30 || info.s === "Sinopse não disponível.";

                if (precisaEnriquecer) {
                    console.log(`🔍 [${i}/${linhas.length}] Enriquecendo: ${nomeLimpo}`);
                    
                    let resultado = await buscarTMDB(nomeLimpo, tipoBusca);
                    
                    if ((!resultado || !resultado.s || resultado.s.length < 30) && tipoBusca === 'series') {
                        console.log(`   ↳ Redundância: Tentando TVMaze...`);
                        const resultadoTVM = await buscarTVMaze(nomeLimpo);
                        if (resultadoTVM && resultadoTVM.s.length > 30) {
                            resultado = { ...resultadoTVM, t: 'series' };
                        }
                    }

                    info = resultado || { p: logoBackup, n: 0, s: "Sinopse não disponível para este conteúdo.", t: tipoBusca };
                    cacheTMDB[nomeLimpo] = info;
                    itensNestaRodada++;

                    // Salva o Cache e o Progresso a cada 20 itens enriquecidos
                    if (itensNestaRodada % 20 === 0) {
                        fs.writeFileSync(ARQUIVO_CACHE, JSON.stringify(cacheTMDB, null, 2));
                        fs.writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify({ ultimoIndex: i, categorias }, null, 2));
                    }
                    await new Promise(r => setTimeout(r, 200)); 
                }

                const itemFinal = {
                    n: String(nomeRaw),
                    u: String(urlVideo),
                    p: info.p || logoBackup,
                    s: info.s,
                    r: Number(info.n) > 0 ? Number(info.n.toFixed(1)) : 0
                };

                if (!categorias[catOriginal]) categorias[catOriginal] = [];
                categorias[catOriginal].push(itemFinal);
                
                // Atualiza o índice atual no progresso mesmo se não buscou na API (já estava no cache)
                if (i % 500 === 0) {
                    fs.writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify({ ultimoIndex: i, categorias }, null, 2));
                }
            }
        }
    }

    // --- FINALIZAÇÃO ---
    console.log("💾 Gravando arquivos finais...");
    
    // Salva cache final
    fs.writeFileSync(ARQUIVO_CACHE, JSON.stringify(cacheTMDB, null, 2));

    // Limpa pasta de saída
    const arquivosAntigos = fs.readdirSync(PASTA_SAIDA);
    for (const f of arquivosAntigos) {
        if (f.endsWith('.json')) fs.unlinkSync(path.join(PASTA_SAIDA, f));
    }

    const menuGlobal = [];
    for (const [nomeCat, lista] of Object.entries(categorias)) {
        const nomeArq = `${formatarNomeArquivo(nomeCat)}.json`;
        fs.writeFileSync(path.join(PASTA_SAIDA, nomeArq), JSON.stringify(lista, null, 2));
        menuGlobal.push({ nome: nomeCat, arquivo: nomeArq, total: lista.length });
    }

    fs.writeFileSync(path.join(PASTA_SAIDA, '_menu.json'), JSON.stringify(menuGlobal, null, 2));

    // Remove o arquivo de progresso pois o trabalho foi concluído
    if (fs.existsSync(ARQUIVO_PROGRESSO)) fs.unlinkSync(ARQUIVO_PROGRESSO);

    console.log(`\n✅ PROCESSO FINALIZADO COM SUCESSO!`);
    console.log(`📂 Pasta: ${PASTA_SAIDA}`);
    console.log(`📦 Total de Títulos Processados: ${Object.values(categorias).flat().length}`);
}

iniciarProcessamento().catch(err => {
    console.error("❌ Ocorreu um erro fatal, mas o progresso foi salvo!", err.message);
});
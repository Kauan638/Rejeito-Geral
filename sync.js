// ========================================================
// ========================================================
// SINCRONIZAÇÃO AUTOMÁTICA — File System Access API
//
// Conecta a subpasta "Rejeito Geral" (dentro da pasta
// mestre) uma única vez. A partir daí, detecta sozinho os
// 2 arquivos pelo NOME (ambos são .csv, então não dá pra
// usar extensão):
//   - nome contém "rejeito" -> Consultar Rejeitos
//   - nome contém "estac"   -> Relatório Estações de Leitura
// e reprocessa automaticamente sempre que qualquer um dos
// dois for salvo/atualizado no disco.
//
// Reaproveita 100% da lógica já existente no projeto:
// lerArquivoTexto(file), parseRejeitos(texto),
// parseEstacoes(texto), renderizarTudo().
//
// IMPORTANTE: renomeie os arquivos na pasta mestre pra
// conter essas palavras-chave no nome (ex: "Rejeito.csv",
// "Estacoes_Leitura.csv").
// ========================================================
// ========================================================

const SYNC_DB_NAME = "rejeito-geral-sync-db";
const SYNC_STORE_NAME = "handles";
const SYNC_HANDLE_KEY = "pastaRejeito";
const SYNC_INTERVALO_MS = 5000; // checa a cada 5s

let syncDirHandle = null;

let syncArquivoRejeitosHandle = null;
let syncArquivoEstacoesHandle = null;

let syncLastModifiedRejeitos = 0;
let syncLastModifiedEstacoes = 0;

let syncIntervalId = null;

// ---------- IndexedDB: persistir o handle da pasta ----------

function syncAbrirDB(){

    return new Promise((resolve, reject)=>{

        const req = indexedDB.open(SYNC_DB_NAME, 1);

        req.onupgradeneeded = ()=>
        req.result.createObjectStore(SYNC_STORE_NAME);

        req.onsuccess = ()=> resolve(req.result);

        req.onerror = ()=> reject(req.error);

    });

}

async function syncSalvarHandle(handle){

    const db = await syncAbrirDB();

    return new Promise((resolve, reject)=>{

        const tx = db.transaction(SYNC_STORE_NAME, "readwrite");

        tx.objectStore(SYNC_STORE_NAME).put(handle, SYNC_HANDLE_KEY);

        tx.oncomplete = resolve;

        tx.onerror = ()=> reject(tx.error);

    });

}

async function syncCarregarHandle(){

    const db = await syncAbrirDB();

    return new Promise((resolve, reject)=>{

        const tx = db.transaction(SYNC_STORE_NAME, "readonly");

        const req = tx.objectStore(SYNC_STORE_NAME).get(SYNC_HANDLE_KEY);

        req.onsuccess = ()=> resolve(req.result || null);

        req.onerror = ()=> reject(req.error);

    });

}

async function syncLimparHandle(){

    const db = await syncAbrirDB();

    const tx = db.transaction(SYNC_STORE_NAME, "readwrite");

    tx.objectStore(SYNC_STORE_NAME).delete(SYNC_HANDLE_KEY);

}

async function syncGarantirPermissao(handle){

    const opcoes = { mode: "read" };

    if((await handle.queryPermission(opcoes)) === "granted") return true;

    if((await handle.requestPermission(opcoes)) === "granted") return true;

    return false;

}

// ---------- UI ----------

function syncSetStatus(tipo, textoExtra){

    const el = document.getElementById("syncStatus");

    if(!el) return;

    const mapa = {

        off: [
            "sync-off",
            '<span class="sync-dot"></span> Sincronização desligada'
        ],

        scan: [
            "sync-scan",
            '<span class="sync-dot"></span> Procurando arquivos na pasta...'
        ],

        on: [
            "sync-on",
            '<span class="sync-dot"></span> Conectado — monitorando' +
            (textoExtra ? ` (${textoExtra})` : "")
        ]

    };

    el.className = mapa[tipo][0];
    el.innerHTML = mapa[tipo][1];

    const btnConectar = document.getElementById("btnConectarPasta");
    const btnDesconectar = document.getElementById("btnDesconectarPasta");

    if(btnConectar) btnConectar.style.display = tipo === "off" ? "inline-block" : "none";
    if(btnDesconectar) btnDesconectar.style.display = tipo === "off" ? "none" : "inline-block";

}

function syncAtualizarUltimaChecagem(){

    const el = document.getElementById("syncUltimaChecagem");

    if(!el) return;

    el.style.display = "inline";

    el.textContent =
    "Última checagem: " +
    new Date().toLocaleTimeString("pt-BR");

}

// ---------- Varredura da subpasta ----------
// Detecção por PALAVRA-CHAVE no nome do arquivo (sem
// acentos), já que os dois arquivos são .csv.

function syncNormalizar(texto){

    return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

}

const SYNC_PALAVRA_REJEITOS = "rejeito";
const SYNC_PALAVRA_ESTACOES = "estac";

function syncTemExtensaoValida(nome){

    return nome.toLowerCase().endsWith(".csv");

}

async function syncVarrerPasta(){

    syncSetStatus("scan");

    syncArquivoRejeitosHandle = null;
    syncArquivoEstacoesHandle = null;

    for await (const [nome, handle] of syncDirHandle.entries()){

        if(handle.kind !== "file") continue;

        if(!syncTemExtensaoValida(nome)) continue;

        const nomeNormalizado = syncNormalizar(nome);

        if(
            !syncArquivoRejeitosHandle &&
            nomeNormalizado.includes(SYNC_PALAVRA_REJEITOS)
        ){

            syncArquivoRejeitosHandle = handle;

        }else if(
            !syncArquivoEstacoesHandle &&
            nomeNormalizado.includes(SYNC_PALAVRA_ESTACOES)
        ){

            syncArquivoEstacoesHandle = handle;

        }

    }

    const faltando = [];

    if(!syncArquivoRejeitosHandle) faltando.push('"rejeito..." (Consultar Rejeitos)');
    if(!syncArquivoEstacoesHandle) faltando.push('"estac..." (Estações de Leitura)');

    if(faltando.length){

        alert(
            "Não encontrei na pasta um arquivo pra cada tipo esperado.\n\n" +
            "Faltando (renomeie o arquivo pra conter a palavra-chave):\n" +
            faltando.map(f=>"• " + f).join("\n")
        );

        return false;

    }

    return true;

}

// ---------- Processamento automático (reaproveita as funções originais) ----------

async function syncProcessarArquivos(){

    try{

        const arquivoRejeitos =
        await syncArquivoRejeitosHandle.getFile();

        const arquivoEstacoes =
        await syncArquivoEstacoesHandle.getFile();

        const [textoRejeitos, textoEstacoes] = await Promise.all([
            lerArquivoTexto(arquivoRejeitos),
            lerArquivoTexto(arquivoEstacoes)
        ]);

        dadosRejeitos = parseRejeitos(textoRejeitos);

        dadosEstacoes = parseEstacoes(textoEstacoes);

        if(!dadosRejeitos.length){

            console.warn("Sincronização: nenhum rejeito encontrado no arquivo.");

            return;

        }

        renderizarTudo();

        // reflete nos campos de nome de arquivo da UI manual também
        document.getElementById("nomeRejeitos").innerText =
        "🔗 " + arquivoRejeitos.name + " (auto)";

        document.getElementById("nomeEstacoes").innerText =
        "🔗 " + arquivoEstacoes.name + " (auto)";

        console.log("Sincronização automática concluída");

    }catch(erro){

        console.error(erro);

    }

}

// ---------- Loop de monitoramento ----------

function syncPararMonitoramento(){

    if(syncIntervalId){

        clearInterval(syncIntervalId);

        syncIntervalId = null;

    }

}

function syncIniciarMonitoramento(){

    syncPararMonitoramento();

    const nomesDetectados = [

        syncArquivoRejeitosHandle?.name,
        syncArquivoEstacoesHandle?.name

    ].filter(Boolean).join(" + ");

    syncSetStatus("on", nomesDetectados);

    syncIntervalId = setInterval(
        syncChecarMudancas,
        SYNC_INTERVALO_MS
    );

}

async function syncChecarMudancas(){

    try{

        let mudou = false;

        const fileRejeitos =
        await syncArquivoRejeitosHandle.getFile();

        if(fileRejeitos.lastModified !== syncLastModifiedRejeitos){

            syncLastModifiedRejeitos = fileRejeitos.lastModified;

            mudou = true;

        }

        const fileEstacoes =
        await syncArquivoEstacoesHandle.getFile();

        if(fileEstacoes.lastModified !== syncLastModifiedEstacoes){

            syncLastModifiedEstacoes = fileEstacoes.lastModified;

            mudou = true;

        }

        syncAtualizarUltimaChecagem();

        if(mudou){

            await syncProcessarArquivos();

        }

    }catch(erro){

        console.error(
            "Erro ao checar mudanças na pasta:",
            erro
        );

    }

}

// ---------- Ações de UI (botões) ----------

async function conectarPastaRejeito(){

    try{

        syncDirHandle = await window.showDirectoryPicker();

        await syncSalvarHandle(syncDirHandle);

        const encontrou = await syncVarrerPasta();

        if(!encontrou){

            syncSetStatus("off");

            return;

        }

        // primeira carga imediata + marca os lastModified atuais
        await syncProcessarArquivos();

        const fileRejeitos = await syncArquivoRejeitosHandle.getFile();
        syncLastModifiedRejeitos = fileRejeitos.lastModified;

        const fileEstacoes = await syncArquivoEstacoesHandle.getFile();
        syncLastModifiedEstacoes = fileEstacoes.lastModified;

        syncIniciarMonitoramento();

    }catch(erro){

        if(erro.name !== "AbortError"){

            console.error(erro);

            alert("Erro ao conectar a pasta: " + erro.message);

        }

    }

}

async function desconectarPastaRejeito(){

    syncPararMonitoramento();

    syncDirHandle = null;
    syncArquivoRejeitosHandle = null;
    syncArquivoEstacoesHandle = null;
    syncLastModifiedRejeitos = 0;
    syncLastModifiedEstacoes = 0;

    await syncLimparHandle();

    syncSetStatus("off");

    const elChecagem = document.getElementById("syncUltimaChecagem");

    if(elChecagem) elChecagem.style.display = "none";

}

// ---------- Reconexão automática ao abrir a página ----------

(async function syncTentarReconectar(){

    const handleSalvo = await syncCarregarHandle();

    if(!handleSalvo) return;

    const temPermissao = await syncGarantirPermissao(handleSalvo);

    if(!temPermissao){

        // não força popup de permissão sem interação do usuário;
        // ele clica em "Conectar Pasta" de novo se precisar
        return;

    }

    syncDirHandle = handleSalvo;

    const encontrou = await syncVarrerPasta();

    if(!encontrou) return;

    const fileRejeitos = await syncArquivoRejeitosHandle.getFile();
    syncLastModifiedRejeitos = fileRejeitos.lastModified;

    const fileEstacoes = await syncArquivoEstacoesHandle.getFile();
    syncLastModifiedEstacoes = fileEstacoes.lastModified;

    await syncProcessarArquivos();

    syncIniciarMonitoramento();

})();

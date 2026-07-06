// ========================================
// RELATÓRIO DE REJEITO GERAL
// Consultar Rejeitos + Estações de Leitura
// ========================================

let dadosRejeitos = [];
let dadosEstacoes = [];

let graficoMotivoChart = null;
let graficoHoraChart = null;

const CORES = {
    amber: "#F2A93B",
    green: "#3DCB82",
    red:   "#E8564F",
    blue:  "#4C8FD1",
    roxo:  "#9B7FD4",
    ciano: "#3BC9DB",
    textMuted: "#8B97A3",
    border: "#2A323B"
};

const PALETA_MOTIVOS = [
    CORES.red, CORES.amber, CORES.blue,
    CORES.roxo, CORES.ciano, CORES.green
];

// Lista fixa de motivos de rejeição (ordem do relatório oficial).
// Motivos encontrados no arquivo que não estejam aqui são
// adicionados automaticamente ao final, nada é descartado.
const MOTIVOS_CANONICOS = [
    { codigo: "SEM_ROTA",                label: "SEM ROTA" },
    { codigo: "VOLUME_NAO_INTEGRADO",     label: "VOLUME NÃO INTEGRADO" },
    { codigo: "NOREAD",                   label: "NOREAD" },
    { codigo: "RAMPA_CHEIA",              label: "RAMPA CHEIA" },
    { codigo: "STATUS_INVALIDO",          label: "STATUS INVÁLIDO" },
    { codigo: "NA_RAMPA",                 label: "NA RAMPA" },
    { codigo: "PERCA_DE_TRACKING",        label: "PERDA DE TRACKING" },
    { codigo: "NAO_RECEBEU_DLST",         label: "NÃO RECEBEU DLST" },
    { codigo: "REJEITO_GERAL",            label: "REJEITO GERAL" },
    { codigo: "CODIGO_PRODUTO_INVALIDO",  label: "CÓDIGO PRODUTO INVÁLIDO" }
];


// ========================================
// UTILITÁRIOS
// ========================================

function nomeArquivoSelecionado(idInput, idLabel){

    const input =
    document.getElementById(idInput);

    const label =
    document.getElementById(idLabel);

    label.innerText =
    input.files.length
    ? input.files[0].name
    : "Nenhum arquivo selecionado";

}

function removerBOM(texto){

    return texto.replace(/^\uFEFF/, "");

}

function lerArquivoTexto(file){

    return new Promise((resolve,reject)=>{

        const reader = new FileReader();

        reader.onload = e => resolve(e.target.result);

        reader.onerror = () => reject(
            new Error("Falha ao ler " + file.name)
        );

        reader.readAsText(file, "UTF-8");

    });

}


// ========================================
// PARSE — CONSULTAR REJEITOS (.csv ; )
// ========================================

function parseRejeitos(texto){

    const linhas =
    removerBOM(texto)
    .split(/\r?\n/)
    .filter(l => l.trim().length);

    linhas.shift();

    const dados = [];

    linhas.forEach(linha=>{

        const campos =
        linha.split(";");

        const [
            local,
            codigo,
            etiqueta,
            ackn,
            estrategia,
            criadoEm,
            stVolume,
            numeroCorrelacao
        ] = campos;

        if(codigo === undefined){

            return;

        }

        const partesData =
        (criadoEm || "").split(",");

        const dataParte =
        (partesData[0] || "").trim();

        const horaParte =
        (partesData[1] || "").trim();

        const hora =
        horaParte
        ? parseInt(horaParte.split(":")[0], 10)
        : null;

        dados.push({
            local: local || "-",
            codigo: codigo || "SEM_CODIGO",
            etiqueta: etiqueta || "-",
            ackn: (ackn || "").trim().toLowerCase() === "true",
            estrategia: estrategia || "-",
            data: dataParte || "-",
            hora: (hora !== null && !isNaN(hora)) ? hora : null,
            stVolume: (stVolume || "").trim() || "Sem Status",
            numeroCorrelacao: (numeroCorrelacao || "").trim()
        });

    });

    return dados;

}


// ========================================
// PARSE — ESTAÇÕES DE LEITURA (.csv , )
// ========================================

function parseEstacoes(texto){

    const linhas =
    removerBOM(texto)
    .split(/\r?\n/)
    .filter(l => l.trim().length);

    linhas.shift();

    const dados = [];

    linhas.forEach(linha=>{

        const campos =
        linha.split(",");

        const [data, leiturasOk, semLeitura] = campos;

        if(data === undefined){

            return;

        }

        dados.push({
            data: data.trim(),
            leiturasOk: parseInt(leiturasOk, 10) || 0,
            semLeitura: parseInt(semLeitura, 10) || 0
        });

    });

    return dados;

}


// ========================================
// PROCESSAMENTO PRINCIPAL
// ========================================

async function processarTudo(){

    const inputRejeitos =
    document.getElementById("arquivoRejeitos");

    const inputEstacoes =
    document.getElementById("arquivoEstacoes");

    if(!inputRejeitos.files.length || !inputEstacoes.files.length){

        alert(
            "Selecione os dois arquivos: Consultar Rejeitos e Relatório Estações de Leitura."
        );

        return;

    }

    try{

        const [textoRejeitos, textoEstacoes] = await Promise.all([
            lerArquivoTexto(inputRejeitos.files[0]),
            lerArquivoTexto(inputEstacoes.files[0])
        ]);

        dadosRejeitos = parseRejeitos(textoRejeitos);

        dadosEstacoes = parseEstacoes(textoEstacoes);

        if(!dadosRejeitos.length){

            alert(
                "Nenhum rejeito encontrado no arquivo. Verifique o arquivo selecionado."
            );

            return;

        }

        renderizarTudo();

    }catch(erro){

        console.error(erro);

        alert(
            "Não foi possível processar os arquivos. Verifique se os formatos estão corretos."
        );

    }

}


// ========================================
// AGREGAÇÕES
// ========================================

function agregarPorCampo(dados, campo){

    const mapa = {};

    dados.forEach(item=>{

        const chave = item[campo];

        mapa[chave] = (mapa[chave] || 0) + 1;

    });

    return mapa;

}

function agregarMotivos(dados){

    const porMotivo = {};

    dados.forEach(item=>{

        if(!porMotivo[item.codigo]){

            porMotivo[item.codigo] = {
                codigo: item.codigo,
                total: 0,
                acknSim: 0,
                acknNao: 0
            };

        }

        porMotivo[item.codigo].total++;

        if(item.ackn){

            porMotivo[item.codigo].acknSim++;

        }else{

            porMotivo[item.codigo].acknNao++;

        }

    });

    return Object.values(porMotivo)
    .sort((a,b) => b.total - a.total);

}

function agregarPorHora(dados){

    const horas =
    new Array(24).fill(0);

    dados.forEach(item=>{

        if(item.hora !== null){

            horas[item.hora]++;

        }

    });

    return horas;

}


// ========================================
// RENDERIZAÇÃO
// ========================================

function formatarPct(valor, total){

    if(!total){

        return "0%";

    }

    return (valor / total * 100)
    .toLocaleString(
        "pt-BR",
        {maximumFractionDigits:1}
    ) + "%";

}

function renderizarTudo(){

    const totalRejeitos =
    dadosRejeitos.length;

    const motivos =
    agregarMotivos(dadosRejeitos);

    const porStatus =
    agregarPorCampo(dadosRejeitos, "stVolume");

    const porHora =
    agregarPorHora(dadosRejeitos);

    const totalLeiturasOk =
    dadosEstacoes.reduce((s,d) => s + d.leiturasOk, 0);

    const totalSemLeitura =
    dadosEstacoes.reduce((s,d) => s + d.semLeitura, 0);

    const totalLeituras =
    totalLeiturasOk + totalSemLeitura;

    // -------- KPIs --------

    document.getElementById("kpiTotalRejeitos").innerText =
    totalRejeitos.toLocaleString("pt-BR");

    if(motivos.length){

        document.getElementById("kpiMotivoPrincipal").innerText =
        `${motivos[0].codigo} (${formatarPct(motivos[0].total, totalRejeitos)})`;

    }

    document.getElementById("kpiTaxaLeitura").innerText =
    formatarPct(totalLeiturasOk, totalLeituras);

    document.getElementById("kpiSemLeitura").innerText =
    totalSemLeitura.toLocaleString("pt-BR");

    // -------- ALERTA DE CONSISTÊNCIA (NOREAD x Sem Leitura) --------

    renderizarAlerta(motivos, totalSemLeitura);

    // -------- GRÁFICOS --------

    renderizarGraficoMotivo(motivos);

    renderizarGraficoHora(porHora);

    // -------- TABELA POR MOTIVO --------

    const corpoMotivos =
    document.getElementById("corpoMotivos");

    corpoMotivos.innerHTML =
    motivos.map(m => `
        <tr>
            <td style="text-align:left;">${m.codigo}</td>
            <td>${m.total.toLocaleString("pt-BR")}</td>
            <td>${formatarPct(m.total, totalRejeitos)}</td>
            <td>${m.acknSim.toLocaleString("pt-BR")}</td>
            <td>${m.acknNao.toLocaleString("pt-BR")}</td>
        </tr>
    `).join("");

    // -------- TABELA POR STATUS --------

    const corpoStatus =
    document.getElementById("corpoStatus");

    const statusOrdenado =
    Object.entries(porStatus)
    .sort((a,b) => b[1] - a[1]);

    corpoStatus.innerHTML =
    statusOrdenado.map(([status,qtd]) => `
        <tr>
            <td style="text-align:left;">${status}</td>
            <td>${qtd.toLocaleString("pt-BR")}</td>
            <td>${formatarPct(qtd, totalRejeitos)}</td>
        </tr>
    `).join("");

    // -------- TABELA ESTAÇÕES DE LEITURA --------

    const corpoEstacoes =
    document.getElementById("corpoEstacoes");

    if(!dadosEstacoes.length){

        corpoEstacoes.innerHTML = `
        <tr>
            <td colspan="5" class="vazio-estado">
                Nenhum dado de estações de leitura encontrado.
            </td>
        </tr>
        `;

    }else{

        corpoEstacoes.innerHTML =
        dadosEstacoes.map(d => {

            const total = d.leiturasOk + d.semLeitura;

            return `
            <tr>
                <td>${d.data}</td>
                <td>${d.leiturasOk.toLocaleString("pt-BR")}</td>
                <td>${d.semLeitura.toLocaleString("pt-BR")}</td>
                <td>${total.toLocaleString("pt-BR")}</td>
                <td>${formatarPct(d.leiturasOk, total)}</td>
            </tr>
            `;

        }).join("")
        + (dadosEstacoes.length > 1 ? `
            <tr style="font-weight:700;background:rgba(255,255,255,.04);">
                <td>TOTAL</td>
                <td>${totalLeiturasOk.toLocaleString("pt-BR")}</td>
                <td>${totalSemLeitura.toLocaleString("pt-BR")}</td>
                <td>${totalLeituras.toLocaleString("pt-BR")}</td>
                <td>${formatarPct(totalLeiturasOk, totalLeituras)}</td>
            </tr>
        ` : "");

    }

    document.getElementById("resultado")
    .classList.remove("oculto");

    // -------- PRÉ-PREENCHER DATA DE REFERÊNCIA --------

    const campoData =
    document.getElementById("configData");

    if(!campoData.value){

        const dataBase =
        dadosEstacoes.length
        ? dadosEstacoes[0].data
        : (dadosRejeitos[0] ? dadosRejeitos[0].data : "");

        campoData.value =
        formatarDataCurta(dataBase);

    }

}

function formatarDataCurta(data){

    if(!data){

        return "";

    }

    // Formato "2026-07-01" (Estações) -> "01/07/26"
    if(/^\d{4}-\d{2}-\d{2}/.test(data)){

        const [ano, mes, dia] = data.split("-");

        return `${dia}/${mes}/${ano.slice(2)}`;

    }

    // Formato "01/07/2026" (Rejeitos) -> "01/07/26"
    if(/^\d{2}\/\d{2}\/\d{4}/.test(data)){

        const [dia, mes, ano] = data.split("/");

        return `${dia}/${mes}/${ano.slice(2)}`;

    }

    return data;

}

function renderizarAlerta(motivos, totalSemLeitura){

    const noread =
    motivos.find(m => m.codigo === "NOREAD");

    const qtdNoread =
    noread ? noread.total : 0;

    const container =
    document.getElementById("alertaConsistencia");

    if(!totalSemLeitura && !qtdNoread){

        container.innerHTML = "";

        return;

    }

    const diferenca =
    Math.abs(qtdNoread - totalSemLeitura);

    const divergenciaAlta =
    totalSemLeitura > 0
    && (diferenca / totalSemLeitura) > 0.15;

    if(divergenciaAlta){

        container.innerHTML = `
        <div class="alerta alerta-atencao">
            ⚠️ <span>
                <strong>Divergência entre bases:</strong>
                NOREAD nos Rejeitos (${qtdNoread.toLocaleString("pt-BR")})
                diverge de Sem Leitura nas Estações (${totalSemLeitura.toLocaleString("pt-BR")})
                em ${diferenca.toLocaleString("pt-BR")} ocorrências. Vale conferir o período coberto por cada arquivo.
            </span>
        </div>
        `;

    }else{

        container.innerHTML = `
        <div class="alerta alerta-ok">
            ✅ <span>
                <strong>Bases consistentes:</strong>
                NOREAD nos Rejeitos (${qtdNoread.toLocaleString("pt-BR")})
                está alinhado com Sem Leitura nas Estações (${totalSemLeitura.toLocaleString("pt-BR")}).
            </span>
        </div>
        `;

    }

}


// ========================================
// GRÁFICOS (Chart.js)
// ========================================

function renderizarGraficoMotivo(motivos){

    const ctx =
    document.getElementById("graficoMotivo");

    if(graficoMotivoChart){

        graficoMotivoChart.destroy();

    }

    graficoMotivoChart = new Chart(ctx, {

        type: "bar",

        data: {
            labels: motivos.map(m => m.codigo),
            datasets: [{
                label: "Quantidade",
                data: motivos.map(m => m.total),
                backgroundColor: motivos.map((_,i) => PALETA_MOTIVOS[i % PALETA_MOTIVOS.length]),
                borderRadius: 4
            }]
        },

        options: {
            indexAxis: "y",
            responsive: true,
            plugins:{
                legend:{ display:false }
            },
            scales:{
                x:{
                    ticks:{ color: CORES.textMuted },
                    grid:{ color: CORES.border }
                },
                y:{
                    ticks:{ color: CORES.textMuted },
                    grid:{ display:false }
                }
            }
        }

    });

}

function renderizarGraficoHora(porHora){

    const ctx =
    document.getElementById("graficoHora");

    if(graficoHoraChart){

        graficoHoraChart.destroy();

    }

    const labels =
    porHora.map((_,i) => i.toString().padStart(2,"0") + "h");

    graficoHoraChart = new Chart(ctx, {

        type: "bar",

        data: {
            labels,
            datasets: [{
                label: "Rejeitos",
                data: porHora,
                backgroundColor: CORES.amber,
                borderRadius: 3
            }]
        },

        options: {
            responsive: true,
            plugins:{
                legend:{ display:false }
            },
            scales:{
                x:{
                    ticks:{ color: CORES.textMuted, maxRotation:0 },
                    grid:{ display:false }
                },
                y:{
                    beginAtZero:true,
                    ticks:{ color: CORES.textMuted, precision:0 },
                    grid:{ color: CORES.border }
                }
            }
        }

    });

}


// ========================================
// RELATÓRIO WHATSAPP (imagem no estilo REJEITOS CD)
// ========================================

function montarLinhasMotivosCanonicos(motivosAgregados, totalRejeitos){

    const mapaEncontrados = {};

    motivosAgregados.forEach(m=>{

        mapaEncontrados[m.codigo] = m.total;

    });

    const usados = new Set();

    const linhas = MOTIVOS_CANONICOS.map(mc=>{

        usados.add(mc.codigo);

        const qtd =
        mapaEncontrados[mc.codigo] || 0;

        return { label: mc.label, qtd };

    });

    // Motivos que apareceram no arquivo mas não estão na lista
    // fixa são incluídos no final, para nada ficar de fora.

    motivosAgregados.forEach(m=>{

        if(!usados.has(m.codigo)){

            linhas.push({
                label: m.codigo.replace(/_/g," "),
                qtd: m.total
            });

        }

    });

    return linhas;

}

async function baixarRelatorioWhatsapp(){

    if(!dadosRejeitos.length){

        alert(
            "Processe os arquivos primeiro."
        );

        return;

    }

    const cd =
    document.getElementById("configCD").value || "CD";

    const dataRef =
    document.getElementById("configData").value || "-";

    const meta =
    parseFloat(
        document.getElementById("configMeta").value
    ) || 0;

    const totalRejeitos =
    dadosRejeitos.length;

    const totalLido =
    dadosEstacoes.reduce(
        (s,d) => s + d.leiturasOk + d.semLeitura,
        0
    );

    const pctRejeitos =
    totalLido
    ? (totalRejeitos / totalLido * 100)
    : 0;

    const delta =
    pctRejeitos - meta;

    const motivos =
    agregarMotivos(dadosRejeitos);

    const linhasMotivos =
    montarLinhasMotivosCanonicos(motivos, totalRejeitos);

    const fmt = n => n.toLocaleString("pt-BR");

    const fmtPct = n => n.toLocaleString(
        "pt-BR",
        {minimumFractionDigits:2, maximumFractionDigits:2}
    ) + "%";

    const deltaTexto =
    (delta >= 0 ? "+" : "") + fmtPct(delta);

    const AZUL = "#1F3864";
    const AZUL_CLARO = "#2E5395";
    const LARANJA = "#C0621A";
    const VERDE_BG = "#E5F5E9";
    const VERDE_TXT = "#1E7B34";
    const ROSA_BG = "#F9D6D5";
    const VERMELHO_TXT = "#C0392B";
    const AMARELO_BG = "#FFF6C6";
    const BORDA = "#B9C4D6";

    let linhasHtml = "";

    linhasMotivos.forEach((item,indice)=>{

        const pct =
        totalLido
        ? (item.qtd / totalLido * 100)
        : 0;

        linhasHtml += `
        <tr>
            <td style="
                padding:9px 14px;
                border:1px solid ${BORDA};
                text-align:left;
                font-weight:700;
                color:#1A1D21;
            ">${item.label}</td>
            <td style="
                padding:9px 14px;
                border:1px solid ${BORDA};
                text-align:center;
                color:#1A1D21;
            ">${fmt(item.qtd)}</td>
            <td style="
                padding:9px 14px;
                border:1px solid ${BORDA};
                text-align:center;
                color:#1A1D21;
            ">${fmtPct(pct)}</td>
            <td style="
                padding:9px 14px;
                border:1px solid ${BORDA};
                text-align:center;
                color:#8B97A3;
            ">—</td>
        </tr>
        `;

    });

    const card = document.createElement("div");

    card.style.width = "600px";
    card.style.background = "#FFFFFF";
    card.style.fontFamily = "'Segoe UI',Arial,sans-serif";
    card.style.overflow = "hidden";
    card.style.border = `1px solid ${BORDA}`;

    card.innerHTML = `

        <div style="
            background:${AZUL};
            padding:18px;
            text-align:center;
        ">
            <span style="
                color:#FFFFFF;
                font-size:20px;
                font-weight:700;
                letter-spacing:.03em;
                text-transform:uppercase;
            ">REJEITOS CD · ${cd.toUpperCase()}</span>
        </div>

        <table style="width:100%;border-collapse:collapse;">

            <tr>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:12px;
                    width:25%;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">Data de Referência</td>
                <td style="
                    background:#fff;
                    color:${LARANJA};
                    padding:12px;
                    width:25%;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">${dataRef}</td>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:12px;
                    width:25%;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">META</td>
                <td style="
                    background:${VERDE_BG};
                    color:${VERDE_TXT};
                    padding:12px;
                    width:25%;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">${fmtPct(meta)}</td>
            </tr>

            <tr>
                <td style="
                    background:${AZUL_CLARO};
                    color:#fff;
                    padding:14px;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">TOTAL LIDO</td>
                <td style="
                    background:#fff;
                    color:#1A1D21;
                    padding:14px;
                    font-weight:700;
                    font-size:17px;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">${fmt(totalLido)}</td>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:14px;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">REJEITOS</td>
                <td style="
                    background:${ROSA_BG};
                    color:${VERMELHO_TXT};
                    padding:14px;
                    font-weight:700;
                    font-size:17px;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">${fmt(totalRejeitos)}</td>
            </tr>

            <tr>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:11px;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">MOTIVO DE REJEIÇÃO</td>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:11px;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">QTD</td>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:11px;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">% DO TOTAL</td>
                <td style="
                    background:${AZUL};
                    color:#fff;
                    padding:11px;
                    font-weight:700;
                    text-align:center;
                    border:1px solid ${BORDA};
                ">DELTA p/ META</td>
            </tr>

            <tr>
                <td style="
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:left;
                    font-weight:700;
                    color:#1A1D21;
                ">TOTAL LIDO</td>
                <td style="
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:center;
                    font-weight:700;
                    color:#1A1D21;
                ">${fmt(totalLido)}</td>
                <td style="
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:center;
                    color:#8B97A3;
                ">—</td>
                <td style="
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:center;
                    color:#8B97A3;
                ">—</td>
            </tr>

            <tr>
                <td style="
                    background:${AMARELO_BG};
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:left;
                    font-weight:700;
                    color:#1A1D21;
                ">TOTAL REJEITOS</td>
                <td style="
                    background:${AMARELO_BG};
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:center;
                    font-weight:700;
                    color:#1A1D21;
                ">${fmt(totalRejeitos)}</td>
                <td style="
                    background:${AMARELO_BG};
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:center;
                    font-weight:700;
                    color:#1A1D21;
                ">${fmtPct(pctRejeitos)}</td>
                <td style="
                    background:${AMARELO_BG};
                    padding:10px 14px;
                    border:1px solid ${BORDA};
                    text-align:center;
                    font-weight:700;
                    color:${VERMELHO_TXT};
                ">${deltaTexto}</td>
            </tr>

            ${linhasHtml}

        </table>

    `;

    card.style.position = "fixed";
    card.style.left = "-9999px";
    card.style.top = "0";

    document.body.appendChild(card);

    try{

        const canvas = await html2canvas(
            card,
            {
                scale: 2,
                backgroundColor: "#FFFFFF"
            }
        );

        const link =
        document.createElement("a");

        link.download =
        `rejeitos-${cd.replace(/\s+/g,"-").toLowerCase()}-${dataRef.replace(/\//g,"-")}.png`;

        link.href =
        canvas.toDataURL("image/png");

        link.click();

    }catch(erro){

        console.error(erro);

        alert(
            "Não foi possível gerar a imagem do relatório."
        );

    }finally{

        card.remove();

    }

}

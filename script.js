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

    const totalSemLeitura =
    dadosEstacoes.reduce(
        (s,d) => s + d.semLeitura,
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
    montarLinhasMotivosCanonicos(motivos, totalRejeitos)
        .slice()
        .sort((a,b) => b.qtd - a.qtd);

    const fmt = n => n.toLocaleString("pt-BR");

    const fmtPct = n => n.toLocaleString(
        "pt-BR",
        {minimumFractionDigits:2, maximumFractionDigits:2}
    ) + "%";

    const deltaTexto =
    (delta >= 0 ? "+" : "") + fmtPct(delta);

    const dentroMeta = pctRejeitos <= meta;

    // Paleta alinhada ao design system do site
    // (graphite + amber/green/red), sobre fundo claro
    // para melhor leitura e compartilhamento no WhatsApp.
    const GRAFITE = "#1D2329";
    const GRAFITE_2 = "#262E36";
    const AMBAR = "#F2A93B";
    const VERDE = "#3DCB82";
    const VERDE_BG = "#E4F8ED";
    const VERDE_TXT = "#1E7B4D";
    const VERMELHO = "#E8564F";
    const VERMELHO_BG = "#FCE9E8";
    const VERMELHO_TXT = "#C13B34";
    const TEXTO = "#1A1D21";
    const TEXTO_MUTED = "#8B97A3";
    const BORDA = "#E4E8ED";
    const LINHA_PAR = "#F7F9FB";

    const corStatus = dentroMeta ? VERDE : VERMELHO;
    const corStatusBg = dentroMeta ? VERDE_BG : VERMELHO_BG;
    const corStatusTxt = dentroMeta ? VERDE_TXT : VERMELHO_TXT;
    const statusLabel = dentroMeta ? "DENTRO DA META" : "ACIMA DA META";

    const maiorQtdMotivo = Math.max(
        1,
        ...linhasMotivos.map(m => m.qtd)
    );

    let linhasHtml = "";

    linhasMotivos.forEach((item,indice)=>{

        const pct =
        totalLido
        ? (item.qtd / totalLido * 100)
        : 0;

        const larguraBarra =
        Math.max(3, (item.qtd / maiorQtdMotivo) * 100);

        const bgLinha = indice % 2 === 0 ? "#FFFFFF" : LINHA_PAR;

        linhasHtml += `
        <tr style="background:${bgLinha};">
            <td style="
                padding:10px 16px;
                text-align:left;
                font-weight:600;
                font-size:13px;
                color:${TEXTO};
                border-bottom:1px solid ${BORDA};
            ">${item.label}</td>
            <td style="
                padding:10px 16px;
                text-align:center;
                font-weight:700;
                font-size:13px;
                color:${TEXTO};
                border-bottom:1px solid ${BORDA};
            ">${fmt(item.qtd)}</td>
            <td style="
                padding:10px 16px;
                text-align:right;
                border-bottom:1px solid ${BORDA};
                width:38%;
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:flex-end;
                    gap:8px;
                ">
                    <div style="
                        flex:1;
                        height:7px;
                        background:${BORDA};
                        border-radius:4px;
                        overflow:hidden;
                    ">
                        <div style="
                            width:${larguraBarra}%;
                            height:100%;
                            background:${AMBAR};
                            border-radius:4px;
                        "></div>
                    </div>
                    <span style="
                        font-size:12px;
                        font-weight:700;
                        color:${TEXTO_MUTED};
                        min-width:44px;
                        text-align:right;
                    ">${fmtPct(pct)}</span>
                </div>
            </td>
        </tr>
        `;

    });

    const card = document.createElement("div");

    card.style.width = "640px";
    card.style.background = "#FFFFFF";
    card.style.fontFamily = "'Inter','Segoe UI',Arial,sans-serif";
    card.style.overflow = "hidden";
    card.style.borderRadius = "16px";
    card.style.border = `1px solid ${BORDA}`;

    card.innerHTML = `

        <!-- CABEÇALHO -->
        <div style="
            background:linear-gradient(135deg, ${GRAFITE} 0%, ${GRAFITE_2} 100%);
            padding:26px 28px 22px;
        ">
            <div style="
                display:flex;
                align-items:center;
                justify-content:space-between;
            ">
                <div>
                    <div style="
                        font-family:'Oswald','Segoe UI',Arial,sans-serif;
                        color:#FFFFFF;
                        font-size:22px;
                        font-weight:600;
                        letter-spacing:.04em;
                        text-transform:uppercase;
                        line-height:1.2;
                    ">🗑️ Relatório de Rejeito</div>
                    <div style="
                        color:${AMBAR};
                        font-size:13px;
                        font-weight:600;
                        letter-spacing:.05em;
                        text-transform:uppercase;
                        margin-top:4px;
                    ">${cd.toUpperCase()}</div>
                </div>
                <div style="
                    background:rgba(255,255,255,.08);
                    border:1px solid rgba(255,255,255,.14);
                    border-radius:10px;
                    padding:8px 14px;
                    text-align:center;
                ">
                    <div style="
                        color:${TEXTO_MUTED};
                        font-size:10px;
                        font-weight:600;
                        letter-spacing:.05em;
                        text-transform:uppercase;
                    ">Referência</div>
                    <div style="
                        color:#FFFFFF;
                        font-size:15px;
                        font-weight:700;
                        margin-top:2px;
                    ">${dataRef}</div>
                </div>
            </div>
        </div>

        <!-- KPIs -->
        <div style="
            display:flex;
            gap:8px;
            padding:20px 20px 4px;
        ">

            <div style="
                flex:1;
                background:${LINHA_PAR};
                border:1px solid ${BORDA};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${TEXTO_MUTED};
                ">Total Lido</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${TEXTO};
                    margin-top:4px;
                ">${fmt(totalLido)}</div>
            </div>

            <div style="
                flex:1;
                background:${LINHA_PAR};
                border:1px solid ${BORDA};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${TEXTO_MUTED};
                ">Sem Leitura</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${TEXTO};
                    margin-top:4px;
                ">${fmt(totalSemLeitura)}</div>
            </div>

            <div style="
                flex:1;
                background:${VERMELHO_BG};
                border:1px solid ${VERMELHO_BG};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${VERMELHO_TXT};
                ">Rejeitos</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${VERMELHO_TXT};
                    margin-top:4px;
                ">${fmt(totalRejeitos)}</div>
            </div>

            <div style="
                flex:1;
                background:${corStatusBg};
                border:1px solid ${corStatusBg};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${corStatusTxt};
                ">% Rejeito</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${corStatusTxt};
                    margin-top:4px;
                ">${fmtPct(pctRejeitos)}</div>
            </div>

        </div>

        <!-- BARRA DE STATUS x META -->
        <div style="
            margin:16px 20px 4px;
            background:${corStatusBg};
            border-radius:10px;
            padding:10px 16px;
            display:flex;
            align-items:center;
            justify-content:space-between;
        ">
            <div style="
                display:flex;
                align-items:center;
                gap:8px;
            ">
                <span style="
                    width:8px;
                    height:8px;
                    border-radius:50%;
                    background:${corStatus};
                    display:inline-block;
                "></span>
                <span style="
                    font-size:12px;
                    font-weight:700;
                    letter-spacing:.03em;
                    color:${corStatusTxt};
                ">${statusLabel}</span>
            </div>
            <div style="
                font-size:12px;
                color:${TEXTO_MUTED};
                font-weight:600;
            ">Meta: <span style="color:${TEXTO};">${fmtPct(meta)}</span> · Delta: <span style="color:${corStatusTxt};">${deltaTexto}</span></div>
        </div>

        <!-- TABELA DE MOTIVOS -->
        <div style="margin:18px 20px 24px;">

            <div style="
                font-family:'Oswald','Segoe UI',Arial,sans-serif;
                font-size:13px;
                font-weight:600;
                letter-spacing:.04em;
                text-transform:uppercase;
                color:${TEXTO};
                margin-bottom:8px;
                padding-left:2px;
            ">Motivos de Rejeição</div>

            <table style="
                width:100%;
                border-collapse:collapse;
                border:1px solid ${BORDA};
                border-radius:10px;
                overflow:hidden;
            ">

                <thead>
                    <tr style="background:${GRAFITE};">
                        <th style="
                            padding:10px 16px;
                            text-align:left;
                            font-size:11px;
                            font-weight:700;
                            letter-spacing:.04em;
                            text-transform:uppercase;
                            color:${AMBAR};
                        ">Motivo</th>
                        <th style="
                            padding:10px 16px;
                            text-align:center;
                            font-size:11px;
                            font-weight:700;
                            letter-spacing:.04em;
                            text-transform:uppercase;
                            color:${AMBAR};
                        ">Qtd</th>
                        <th style="
                            padding:10px 16px;
                            text-align:right;
                            font-size:11px;
                            font-weight:700;
                            letter-spacing:.04em;
                            text-transform:uppercase;
                            color:${AMBAR};
                        ">% do Total</th>
                    </tr>
                </thead>

                <tbody>
                    ${linhasHtml}
                </tbody>

            </table>

        </div>

        <!-- RODAPÉ -->
        <div style="
            background:${GRAFITE};
            padding:10px 20px;
            display:flex;
            align-items:center;
            justify-content:space-between;
        ">
            <span style="
                color:${TEXTO_MUTED};
                font-size:10px;
                font-weight:500;
            ">Gerado em ${new Date().toLocaleString("pt-BR")}</span>
            <span style="
                color:${TEXTO_MUTED};
                font-size:10px;
                font-weight:700;
                letter-spacing:.05em;
            ">CD-107 · PCP</span>
        </div>

    `;

    card.style.position = "fixed";
    card.style.left = "-9999px";
    card.style.top = "0";

    document.body.appendChild(card);

    const botao =
    document.getElementById("btnExportarWhatsapp");

    const rotuloOriginal =
    botao ? botao.innerHTML : null;

    const nomeArquivo =
    `rejeitos-${cd.replace(/\s+/g,"-").toLowerCase()}-${dataRef.replace(/\//g,"-")}.png`;

    function baixarBlob(blob){

        const link =
        document.createElement("a");

        link.download = nomeArquivo;

        link.href =
        URL.createObjectURL(blob);

        link.click();

        setTimeout(
            () => URL.revokeObjectURL(link.href),
            5000
        );

    }

    try{

        const canvas = await html2canvas(
            card,
            {
                scale: 2,
                backgroundColor: "#FFFFFF"
            }
        );

        const blob = await new Promise(
            resolve => canvas.toBlob(resolve, "image/png")
        );

        if(!blob){

            throw new Error(
                "Falha ao gerar a imagem do relatório."
            );

        }

        if(navigator.clipboard && window.ClipboardItem){

            try{

                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob })
                ]);

                if(botao){

                    botao.innerHTML =
                    "✅ Copiado! Cole no WhatsApp (Ctrl+V)";

                    setTimeout(()=>{

                        botao.innerHTML = rotuloOriginal;

                    }, 3500);

                }else{

                    alert(
                        "Relatório copiado! Cole no WhatsApp com Ctrl+V."
                    );

                }

            }catch(erroClipboard){

                console.error(erroClipboard);

                baixarBlob(blob);

                alert(
                    "Não foi possível copiar automaticamente. O relatório foi baixado como imagem."
                );

            }

        }else{

            baixarBlob(blob);

            alert(
                "Seu navegador não suporta copiar imagens. O relatório foi baixado."
            );

        }

    }catch(erro){

        console.error(erro);

        alert(
            "Não foi possível gerar a imagem do relatório."
        );

    }finally{

        card.remove();

    }

}


// ========================================
// RELATÓRIO WHATSAPP — REJEITO POR HORA
// ========================================

function montarLinhasPorHora(dadosRejeitos){

    const horas =
    agregarPorHora(dadosRejeitos);

    const semHorario =
    dadosRejeitos.filter(d => d.hora === null).length;

    const linhas = [];

    horas.forEach((qtd,hora)=>{

        if(qtd > 0){

            linhas.push({
                label: hora.toString().padStart(2,"0") + "h",
                qtd
            });

        }

    });

    if(semHorario > 0){

        linhas.push({
            label: "SEM HORÁRIO",
            qtd: semHorario
        });

    }

    return linhas;

}

async function baixarRelatorioWhatsappHora(){

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

    const totalRejeitos =
    dadosRejeitos.length;

    const linhasHora =
    montarLinhasPorHora(dadosRejeitos);

    // Ordem cronológica (00h -> 23h), "SEM HORÁRIO" sempre ao final.
    linhasHora.sort((a,b)=>{

        if(a.label === "SEM HORÁRIO") return 1;
        if(b.label === "SEM HORÁRIO") return -1;

        return a.label.localeCompare(b.label);

    });

    // Horário de pico (maior quantidade; ignora "SEM HORÁRIO").
    const linhasComHora =
    linhasHora.filter(l => l.label !== "SEM HORÁRIO");

    const picoHora =
    linhasComHora.reduce(
        (max,item) => (!max || item.qtd > max.qtd) ? item : max,
        null
    );

    const horasAtivas =
    linhasComHora.length;

    const mediaPorHoraAtiva =
    horasAtivas
    ? totalRejeitos / horasAtivas
    : 0;

    const fmt = n => n.toLocaleString("pt-BR");

    const fmtPct = n => n.toLocaleString(
        "pt-BR",
        {minimumFractionDigits:2, maximumFractionDigits:2}
    ) + "%";

    const fmtDec = n => n.toLocaleString(
        "pt-BR",
        {minimumFractionDigits:1, maximumFractionDigits:1}
    );

    // Paleta alinhada ao design system do site.
    const GRAFITE = "#1D2329";
    const GRAFITE_2 = "#262E36";
    const AMBAR = "#F2A93B";
    const TEXTO = "#1A1D21";
    const TEXTO_MUTED = "#8B97A3";
    const BORDA = "#E4E8ED";
    const LINHA_PAR = "#F7F9FB";

    const maiorQtdHora = Math.max(
        1,
        ...linhasHora.map(l => l.qtd)
    );

    let linhasHtml = "";

    linhasHora.forEach((item,indice)=>{

        const pct =
        totalRejeitos
        ? (item.qtd / totalRejeitos * 100)
        : 0;

        const larguraBarra =
        Math.max(3, (item.qtd / maiorQtdHora) * 100);

        const bgLinha = indice % 2 === 0 ? "#FFFFFF" : LINHA_PAR;

        const ehPico =
        picoHora && item.label === picoHora.label;

        linhasHtml += `
        <tr style="background:${bgLinha};">
            <td style="
                padding:10px 16px;
                text-align:left;
                font-weight:600;
                font-size:13px;
                color:${TEXTO};
                border-bottom:1px solid ${BORDA};
            ">${item.label}${ehPico ? " 🔺" : ""}</td>
            <td style="
                padding:10px 16px;
                text-align:center;
                font-weight:700;
                font-size:13px;
                color:${TEXTO};
                border-bottom:1px solid ${BORDA};
            ">${fmt(item.qtd)}</td>
            <td style="
                padding:10px 16px;
                text-align:right;
                border-bottom:1px solid ${BORDA};
                width:38%;
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:flex-end;
                    gap:8px;
                ">
                    <div style="
                        flex:1;
                        height:7px;
                        background:${BORDA};
                        border-radius:4px;
                        overflow:hidden;
                    ">
                        <div style="
                            width:${larguraBarra}%;
                            height:100%;
                            background:${ehPico ? "#E8564F" : AMBAR};
                            border-radius:4px;
                        "></div>
                    </div>
                    <span style="
                        font-size:12px;
                        font-weight:700;
                        color:${TEXTO_MUTED};
                        min-width:44px;
                        text-align:right;
                    ">${fmtPct(pct)}</span>
                </div>
            </td>
        </tr>
        `;

    });

    const card = document.createElement("div");

    card.style.width = "640px";
    card.style.background = "#FFFFFF";
    card.style.fontFamily = "'Inter','Segoe UI',Arial,sans-serif";
    card.style.overflow = "hidden";
    card.style.borderRadius = "16px";
    card.style.border = `1px solid ${BORDA}`;

    card.innerHTML = `

        <!-- CABEÇALHO -->
        <div style="
            background:linear-gradient(135deg, ${GRAFITE} 0%, ${GRAFITE_2} 100%);
            padding:26px 28px 22px;
        ">
            <div style="
                display:flex;
                align-items:center;
                justify-content:space-between;
            ">
                <div>
                    <div style="
                        font-family:'Oswald','Segoe UI',Arial,sans-serif;
                        color:#FFFFFF;
                        font-size:22px;
                        font-weight:600;
                        letter-spacing:.04em;
                        text-transform:uppercase;
                        line-height:1.2;
                    ">🕐 Rejeito por Hora</div>
                    <div style="
                        color:${AMBAR};
                        font-size:13px;
                        font-weight:600;
                        letter-spacing:.05em;
                        text-transform:uppercase;
                        margin-top:4px;
                    ">${cd.toUpperCase()}</div>
                </div>
                <div style="
                    background:rgba(255,255,255,.08);
                    border:1px solid rgba(255,255,255,.14);
                    border-radius:10px;
                    padding:8px 14px;
                    text-align:center;
                ">
                    <div style="
                        color:${TEXTO_MUTED};
                        font-size:10px;
                        font-weight:600;
                        letter-spacing:.05em;
                        text-transform:uppercase;
                    ">Referência</div>
                    <div style="
                        color:#FFFFFF;
                        font-size:15px;
                        font-weight:700;
                        margin-top:2px;
                    ">${dataRef}</div>
                </div>
            </div>
        </div>

        <!-- KPIs -->
        <div style="
            display:flex;
            gap:8px;
            padding:20px 20px 4px;
        ">

            <div style="
                flex:1;
                background:${LINHA_PAR};
                border:1px solid ${BORDA};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${TEXTO_MUTED};
                ">Total Rejeitos</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${TEXTO};
                    margin-top:4px;
                ">${fmt(totalRejeitos)}</div>
            </div>

            <div style="
                flex:1;
                background:${LINHA_PAR};
                border:1px solid ${BORDA};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${TEXTO_MUTED};
                ">Horas Ativas</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${TEXTO};
                    margin-top:4px;
                ">${fmt(horasAtivas)}</div>
            </div>

            <div style="
                flex:1;
                background:${LINHA_PAR};
                border:1px solid ${BORDA};
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:${TEXTO_MUTED};
                ">Média / Hora Ativa</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:${TEXTO};
                    margin-top:4px;
                ">${fmtDec(mediaPorHoraAtiva)}</div>
            </div>

            <div style="
                flex:1;
                background:#FCE9E8;
                border:1px solid #FCE9E8;
                border-radius:12px;
                padding:12px 8px;
                text-align:center;
            ">
                <div style="
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:.04em;
                    text-transform:uppercase;
                    color:#C13B34;
                ">Pico</div>
                <div style="
                    font-family:'Oswald','Segoe UI',Arial,sans-serif;
                    font-size:21px;
                    font-weight:600;
                    color:#C13B34;
                    margin-top:4px;
                ">${picoHora ? picoHora.label : "-"}</div>
            </div>

        </div>

        <!-- TABELA POR HORA -->
        <div style="margin:18px 20px 24px;">

            <div style="
                font-family:'Oswald','Segoe UI',Arial,sans-serif;
                font-size:13px;
                font-weight:600;
                letter-spacing:.04em;
                text-transform:uppercase;
                color:${TEXTO};
                margin-bottom:8px;
                padding-left:2px;
            ">Rejeitos por Hora</div>

            <table style="
                width:100%;
                border-collapse:collapse;
                border:1px solid ${BORDA};
                border-radius:10px;
                overflow:hidden;
            ">

                <thead>
                    <tr style="background:${GRAFITE};">
                        <th style="
                            padding:10px 16px;
                            text-align:left;
                            font-size:11px;
                            font-weight:700;
                            letter-spacing:.04em;
                            text-transform:uppercase;
                            color:${AMBAR};
                        ">Hora</th>
                        <th style="
                            padding:10px 16px;
                            text-align:center;
                            font-size:11px;
                            font-weight:700;
                            letter-spacing:.04em;
                            text-transform:uppercase;
                            color:${AMBAR};
                        ">Qtd</th>
                        <th style="
                            padding:10px 16px;
                            text-align:right;
                            font-size:11px;
                            font-weight:700;
                            letter-spacing:.04em;
                            text-transform:uppercase;
                            color:${AMBAR};
                        ">% do Total</th>
                    </tr>
                </thead>

                <tbody>
                    ${linhasHtml || `
                    <tr>
                        <td colspan="3" style="
                            padding:16px;
                            text-align:center;
                            color:${TEXTO_MUTED};
                            font-size:13px;
                        ">Nenhum rejeito com horário registrado.</td>
                    </tr>
                    `}
                </tbody>

            </table>

        </div>

        <!-- RODAPÉ -->
        <div style="
            background:${GRAFITE};
            padding:10px 20px;
            display:flex;
            align-items:center;
            justify-content:space-between;
        ">
            <span style="
                color:${TEXTO_MUTED};
                font-size:10px;
                font-weight:500;
            ">Gerado em ${new Date().toLocaleString("pt-BR")}</span>
            <span style="
                color:${TEXTO_MUTED};
                font-size:10px;
                font-weight:700;
                letter-spacing:.05em;
            ">CD-107 · PCP</span>
        </div>

    `;

    card.style.position = "fixed";
    card.style.left = "-9999px";
    card.style.top = "0";

    document.body.appendChild(card);

    const botao =
    document.getElementById("btnExportarWhatsappHora");

    const rotuloOriginal =
    botao ? botao.innerHTML : null;

    const nomeArquivo =
    `rejeitos-por-hora-${cd.replace(/\s+/g,"-").toLowerCase()}-${dataRef.replace(/\//g,"-")}.png`;

    function baixarBlob(blob){

        const link =
        document.createElement("a");

        link.download = nomeArquivo;

        link.href =
        URL.createObjectURL(blob);

        link.click();

        setTimeout(
            () => URL.revokeObjectURL(link.href),
            5000
        );

    }

    try{

        const canvas = await html2canvas(
            card,
            {
                scale: 2,
                backgroundColor: "#FFFFFF"
            }
        );

        const blob = await new Promise(
            resolve => canvas.toBlob(resolve, "image/png")
        );

        if(!blob){

            throw new Error(
                "Falha ao gerar a imagem do relatório."
            );

        }

        if(navigator.clipboard && window.ClipboardItem){

            try{

                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob })
                ]);

                if(botao){

                    botao.innerHTML =
                    "✅ Copiado! Cole no WhatsApp (Ctrl+V)";

                    setTimeout(()=>{

                        botao.innerHTML = rotuloOriginal;

                    }, 3500);

                }else{

                    alert(
                        "Relatório copiado! Cole no WhatsApp com Ctrl+V."
                    );

                }

            }catch(erroClipboard){

                console.error(erroClipboard);

                baixarBlob(blob);

                alert(
                    "Não foi possível copiar automaticamente. O relatório foi baixado como imagem."
                );

            }

        }else{

            baixarBlob(blob);

            alert(
                "Seu navegador não suporta copiar imagens. O relatório foi baixado."
            );

        }

    }catch(erro){

        console.error(erro);

        alert(
            "Não foi possível gerar a imagem do relatório."
        );

    }finally{

        card.remove();

    }

}

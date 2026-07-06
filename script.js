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

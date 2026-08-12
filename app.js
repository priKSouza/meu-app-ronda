// ==============================================================================
// 1. CONFIGURAÇÕES, ESTADO GLOBAL E CONSTANTES
// ==============================================================================

// Lista dos 18 Itens de Inspeção de Sinalização da Unimed Litoral
const ITENS_INSPECAO = [
    "Fachada Principal",
    "Tótens Externos",
    "Placas Externas de Orientação e avisos",
    "Sinalização de Estacionamento",
    "Placas de Guichê e Balcões",
    "Placas de Porta (Salas/Consultórios)",
    "Placas Aéreas (Teto)",
    "Placas de Parede (avisos e isnalizações)",
    "Placas de Emergência e Segurança - SSGA",
    "Sinalização no Espaço Café",
    "Rotas de Fuga (Sinalização SSGA)",
    "Pesquisas de Satisfação (Verificar Layout Cinza Atualizado)",
    "Plotagens em Portas de Vidro (Faixas, Letras e Adesivos blackout/jateado)",
    "Faixas de Chão (Oracal)",
    "Elevadores (Faixas e Acrílico Interno)",
    "Impressões Avulsas / Poluição Visual (Proibido papéis sem acrílico ou fora do padrão)",
    "TVs e Mídias (Vídeos institucionais ativos. Exceções: Oncologia, Área Kids, EVB)",
    "Adesivos de armários"
];

// Endpoint Padrão do Webhook do Google Apps Script
const WEBHOOK_DEFAULT = "https://script.google.com/macros/s/AKfycbxT2nc6TsQDgvSvCKXLqeFLcJRRptyBzd7NJXKCFWlytQQzGSxRkCRupyF4DXqZdDWm/exec";

// Estado da Ronda Atual
let estadoRonda = {
    ID_Ronda: "",
    Data_Hora: "",
    Inspetor: "",
    Unidade_Local: "",
    itens: {} 
};

// Instâncias dos Gráficos do Chart.js
let chartUnidadesInstance = null;
let chartItensInstance = null;


// ==============================================================================
// 2. INICIALIZAÇÃO DA APLICAÇÃO
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
    inicializarConfiguracoes();
    inicializarFormularioRonda();
    carregarDashboardEHistorico();
});

// Inicializa URL do Webhook no localStorage
function inicializarConfiguracoes() {
    let urlSalva = localStorage.getItem("unimed_webhook_url");
    if (!urlSalva) {
        localStorage.setItem("unimed_webhook_url", WEBHOOK_DEFAULT);
        urlSalva = WEBHOOK_DEFAULT;
    }
    const inputWebhook = document.getElementById("input-webhook-url");
    if (inputWebhook) inputWebhook.value = urlSalva;

    // Configura o botão de engrenagem
    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            document.getElementById("modal-settings").classList.remove("hidden");
        });
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("hidden");
}

function salvarConfiguracaoWebhook() {
    const input = document.getElementById("input-webhook-url");
    if (input && input.value.trim() !== "") {
        localStorage.setItem("unimed_webhook_url", input.value.trim());
        alert("URL do Webhook atualizada com sucesso!");
        fecharModal("modal-settings");
    } else {
        alert("Por favor, insira uma URL válida.");
    }
}


// ==============================================================================
// 3. CONSTRUÇÃO DO FORMULÁRIO DOS 18 ITENS (TAB 1)
// ==============================================================================
function inicializarFormularioRonda() {
    // Define Data/Hora atual
    const agora = new Date();
    const dataLocal = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById("data-hora-ronda").value = dataLocal;

    // Gera ID único da Ronda
    estadoRonda.ID_Ronda = `R-${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const container = document.getElementById("container-itens-inspecao");
    container.innerHTML = "";

    // Reinicia o estado dos itens
    estadoRonda.itens = {};

    ITENS_INSPECAO.forEach((nomeItem, index) => {
        const idItem = `item_${index}`;
        
        // Estado inicial de cada item: N/A e array de evidências vazio
        estadoRonda.itens[idItem] = {
            index: index + 1,
            nome: nomeItem,
            status: "N/A",
            evidencias: []
        };

        // Renderiza o card do item no HTML
        const cardHTML = `
            <div id="card_${idItem}" class="item-card bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-2">
                    <span class="font-bold text-gray-800 text-sm md:text-base">
                        <span class="text-unimed-green">${String(index + 1).padStart(2, '0')}.</span> ${nomeItem}
                    </span>
                    
                    <!-- Botões Toggle de Status -->
                    <div class="flex space-x-1">
                        <button type="button" onclick="definirStatusItem('${idItem}', 'Conforme')" id="btn_conforme_${idItem}" class="btn-status btn-status-conforme flex-1 md:flex-initial px-3 py-1.5 text-xs font-semibold border rounded-md text-gray-600 bg-gray-50 hover:bg-green-50">
                            <i class="fa-solid fa-check mr-1"></i> Conforme
                        </button>
                        <button type="button" onclick="definirStatusItem('${idItem}', 'Não Conforme')" id="btn_nao_conforme_${idItem}" class="btn-status btn-status-nao-conforme flex-1 md:flex-initial px-3 py-1.5 text-xs font-semibold border rounded-md text-gray-600 bg-gray-50 hover:bg-red-50">
                            <i class="fa-solid fa-xmark mr-1"></i> Não Conforme
                        </button>
                        <button type="button" onclick="definirStatusItem('${idItem}', 'N/A')" id="btn_na_${idItem}" class="btn-status btn-status-na active flex-1 md:flex-initial px-3 py-1.5 text-xs font-semibold border rounded-md text-gray-600 bg-gray-50">
                            N/A
                        </button>
                    </div>
                </div>

                <!-- Container do Bloco de Evidências (Oculto por padrão para Conforme e N/A) -->
                <div id="painel_detalhes_${idItem}" class="hidden space-y-3 pt-2">
                    <div class="bg-red-50/50 p-3 rounded-md border border-red-100 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-red-700 flex items-center gap-1.5">
                                <i class="fa-solid fa-triangle-exclamation"></i> Registro de Evidências da Avaria
                            </span>
                            <span class="text-[11px] text-gray-500">Adicione foto, local e descrição</span>
                        </div>

                        <!-- Lista de Cards de Evidências -->
                        <div id="lista_evidencias_${idItem}" class="space-y-3"></div>

                        <!-- Botão para adicionar mais uma evidência -->
                        <button type="button" onclick="adicionarCardEvidencia('${idItem}')" class="w-full py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 border-dashed font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1">
                            <i class="fa-solid fa-plus"></i> Adicionar Mais Uma Evidência / Foto
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", cardHTML);
    });

    atualizarContadoresStatus();
}

// Alterna os botões de status (Conforme / Não Conforme / N/A)
function definirStatusItem(idItem, novoStatus) {
    estadoRonda.itens[idItem].status = novoStatus;

    const card = document.getElementById(`card_${idItem}`);
    const btnConforme = document.getElementById(`btn_conforme_${idItem}`);
    const btnNaoConforme = document.getElementById(`btn_nao_conforme_${idItem}`);
    const btnNA = document.getElementById(`btn_na_${idItem}`);
    const painelDetalhes = document.getElementById(`painel_detalhes_${idItem}`);

    // Limpa classes ativas dos botões
    btnConforme.classList.remove("active");
    btnNaoConforme.classList.remove("active");
    btnNA.classList.remove("active");

    // Limpa destaques do card
    card.classList.remove("item-card-conforme", "item-card-nao-conforme");

    if (novoStatus === "Conforme") {
        btnConforme.classList.add("active");
        card.classList.add("item-card-conforme");
        painelDetalhes.classList.add("hidden");
    } else if (novoStatus === "Não Conforme") {
        btnNaoConforme.classList.add("active");
        card.classList.add("item-card-nao-conforme");
        painelDetalhes.classList.remove("hidden");

        // Se for Não Conforme e ainda não tiver nenhuma evidência criada, adiciona a primeira automaticamente
        if (estadoRonda.itens[idItem].evidencias.length === 0) {
            adicionarCardEvidencia(idItem);
        }
    } else {
        btnNA.classList.add("active");
        painelDetalhes.classList.add("hidden");
    }

    atualizarContadoresStatus();
}

// Gerenciamento dos Cards Dinâmicos de Evidências (Foto + Local + Descrição)
function adicionarCardEvidencia(idItem) {
    const evId = 'ev_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    estadoRonda.itens[idItem].evidencias.push({
        id: evId,
        local: "",
        descricao: "",
        foto: ""
    });

    renderizarCardsEvidencia(idItem);
}

function removerCardEvidencia(idItem, evId) {
    estadoRonda.itens[idItem].evidencias = estadoRonda.itens[idItem].evidencias.filter(ev => ev.id !== evId);
    renderizarCardsEvidencia(idItem);
}

function renderizarCardsEvidencia(idItem) {
    const container = document.getElementById(`lista_evidencias_${idItem}`);
    if (!container) return;
    
    container.innerHTML = "";

    estadoRonda.itens[idItem].evidencias.forEach((ev, idx) => {
        const evHTML = `
            <div id="card_ev_${ev.id}" class="bg-white p-3 rounded-md border border-gray-200 shadow-sm relative space-y-2">
                <div class="flex items-center justify-between border-b pb-1">
                    <span class="text-xs font-semibold text-gray-700">Evidência #${idx + 1}</span>
                    <button type="button" onclick="removerCardEvidencia('${idItem}', '${ev.id}')" class="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1" title="Remover Evidência">
                        <i class="fa-solid fa-trash-can"></i> Excluir
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[11px] font-medium text-gray-600 mb-0.5">Local / Sala / Setor <span class="text-red-500">*</span></label>
                        <input type="text" value="${ev.local || ''}" oninput="atualizarDadosEvidencia('${idItem}', '${ev.id}', 'local', this.value)" placeholder="Ex: Recepção, Consultório 02, Corridor B..." class="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-unimed-green focus:outline-none">
                    </div>

                    <div>
                        <label class="block text-[11px] font-medium text-gray-600 mb-0.5">Descrição da Avaria <span class="text-red-500">*</span></label>
                        <input type="text" value="${ev.descricao || ''}" oninput="atualizarDadosEvidencia('${idItem}', '${ev.id}', 'descricao', this.value)" placeholder="Ex: Acrílico quebrado, vinil descascando..." class="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-unimed-green focus:outline-none">
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-medium text-gray-600 mb-1">Foto da Avaria <span class="text-red-500">*</span></label>
                    <div class="flex items-center gap-3">
                        <label class="cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-medium text-gray-700 flex items-center gap-1.5 transition-colors">
                            <i class="fa-solid fa-camera text-unimed-green"></i> ${ev.foto ? 'Trocar Foto' : 'Capturar / Carregar Foto'}
                            <input type="file" accept="image/*" onchange="processarUploadFotoEvidencia('${idItem}', '${ev.id}', this)" class="hidden">
                        </label>
                        
                        <div id="thumb_ev_${ev.id}">
                            ${ev.foto ? `
                                <div class="thumb-container">
                                    <img src="${ev.foto}" alt="Preview">
                                </div>
                            ` : '<span class="text-[11px] text-gray-400 italic">Nenhuma foto selecionada</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", evHTML);
    });
}

function atualizarDadosEvidencia(idItem, evId, campo, valor) {
    const ev = estadoRonda.itens[idItem].evidencias.find(e => e.id === evId);
    if (ev) {
        ev[campo] = valor;
    }
}

function processarUploadFotoEvidencia(idItem, evId, input) {
    const file = input.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    comprimirImagem(file, 800, 0.5, (base64Comprimido) => {
        const ev = estadoRonda.itens[idItem].evidencias.find(e => e.id === evId);
        if (ev) {
            ev.foto = base64Comprimido;
            renderizarCardsEvidencia(idItem);
        }
    });

    input.value = "";
}

function atualizarContadoresStatus() {
    let conformes = 0;
    let naoConformes = 0;
    let na = 0;

    Object.values(estadoRonda.itens).forEach(item => {
        if (item.status === "Conforme") conformes++;
        else if (item.status === "Não Conforme") naoConformes++;
        else na++;
    });

    document.getElementById("count-conformes").textContent = conformes;
    document.getElementById("count-nao-conformes").textContent = naoConformes;
    document.getElementById("count-na").textContent = na;
}


// ==============================================================================
// 4. COMPRESSÃO DE FOTOS CLIENT-SIDE (HTML5 CANVAS 800px / JPEG 0.5)
// ==============================================================================
function comprimirImagem(file, maxDimension, quality, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrlComprimida = canvas.toDataURL("image/jpeg", quality);
            callback(dataUrlComprimida);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}


// ==============================================================================
// 5. ENVIO DE DADOS PARA O GOOGLE APPS SCRIPT (WEBHOOK)
// ==============================================================================
async function processarEnvioRonda() {
    const unidade = document.getElementById("unidade-local").value.trim();
    const inspetor = document.getElementById("nome-inspetor").value.trim();

    if (!unidade || !inspetor) {
        alert("Por favor, preencha os campos obrigatórios: Unidade/Local e Nome do Inspetor.");
        return;
    }

    // Validação de itens Não Conformes (Exige ao menos 1 evidência completa)
    let pendencias = [];
    Object.values(estadoRonda.itens).forEach(item => {
        if (item.status === "Não Conforme") {
            if (item.evidencias.length === 0) {
                pendencias.push(`- Item "${item.nome}" exige pelo menos 1 evidência cadastrada.`);
            } else {
                item.evidencias.forEach((ev, idx) => {
                    if (!ev.local.trim()) {
                        pendencias.push(`- Item "${item.nome}" (Evidência #${idx + 1}): Preencha o Local/Sala.`);
                    }
                    if (!ev.descricao.trim()) {
                        pendencias.push(`- Item "${item.nome}" (Evidência #${idx + 1}): Preencha a Descrição da avaria.`);
                    }
                    if (!ev.foto) {
                        pendencias.push(`- Item "${item.nome}" (Evidência #${idx + 1}): Anexe a Foto.`);
                    }
                });
            }
        }
    });

    if (pendencias.length > 0) {
        alert("Atenção! Complete os campos obrigatórios das evidências não conformes:\n\n" + pendencias.join("\n"));
        return;
    }

    // Calcula totais
    let totalConformes = 0;
    let totalNaoConformes = 0;
    let itensDetalhadosArray = [];

    Object.values(estadoRonda.itens).forEach(item => {
        if (item.status === "Conforme") totalConformes++;
        if (item.status === "Não Conforme") totalNaoConformes++;

        itensDetalhadosArray.push({
            Nome_Item: item.nome,
            Status: item.status,
            Evidencias: item.evidencias.map(e => ({
                Local: e.local,
                Descricao: e.descricao,
                Foto: e.foto
            }))
        });
    });

    // Converte a data do formulário para o padrão brasileiro (DD/MM/AAAA HH:mm)
    let dataInput = document.getElementById("data-hora-ronda").value;
    let dataFormatada = "";

    if (dataInput) {
        const [dataPart, horaPart] = dataInput.split("T");
        const [ano, mes, dia] = dataPart.split("-");
        dataFormatada = `${dia}/${mes}/${ano} ${horaPart}`;
    } else {
        dataFormatada = new Date().toLocaleString("pt-BR");
    }

    // Monta o Payload para envio
    const payload = {
        ID_Ronda: estadoRonda.ID_Ronda,
        Data_Hora: dataFormatada,
        Inspetor: inspetor,
        Unidade_Local: unidade,
        Total_Conformes: totalConformes,
        Total_Nao_Conformes: totalNaoConformes,
        Status_Geral: totalNaoConformes === 0 ? "Conforme" : "Com Avarias",
        Itens_Detalhados: itensDetalhadosArray
    };

    const btnEnviar = document.getElementById("btn-finalizar-ronda");
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Salvando no Google Drive...`;

    const urlWebhook = localStorage.getItem("unimed_webhook_url") || WEBHOOK_DEFAULT;

    try {
        await fetch(urlWebhook, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload),
            redirect: "follow"
        });

        salvarEnvioLocal(payload);

        document.getElementById("resumo-conformes").textContent = totalConformes;
        document.getElementById("resumo-nao-conformes").textContent = totalNaoConformes;
        document.getElementById("modal-resumo").classList.remove("hidden");

        carregarDashboardEHistorico();

    } catch (erro) {
        console.error("Erro ao enviar webhook:", erro);
        alert("Sua ronda foi gravada localmente no dispositivo, porém ocorreu uma instabilidade na comunicação com o servidor: " + erro.message);
        
        salvarEnvioLocal(payload);
        carregarDashboardEHistorico();
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = `<i class="fa-solid fa-paper-plane mr-2"></i> Finalizar e Salvar Ronda`;
    }
}

function salvarEnvioLocal(payload) {
    let historico = JSON.parse(localStorage.getItem("unimed_historico_rondas") || "[]");
    historico.unshift(payload);
    localStorage.setItem("unimed_historico_rondas", JSON.stringify(historico));
}

function resetarFormulario() {
    document.getElementById("unidade-local").value = "";
    document.getElementById("nome-inspetor").value = "";
    inicializarFormularioRonda();
}


// ==============================================================================
// 6. DASHBOARD, KPIS & HISTÓRICO (TAB 2)
// ==============================================================================
function alternarAba(aba) {
    const btnNova = document.getElementById("tab-btn-nova");
    const btnDash = document.getElementById("tab-btn-dashboard");
    const abaNova = document.getElementById("aba-nova-ronda");
    const abaDash = document.getElementById("aba-dashboard");

    if (aba === "nova") {
        abaNova.classList.remove("hidden");
        abaDash.classList.add("hidden");
        btnNova.classList.add("bg-unimed-green", "border-white");
        btnNova.classList.remove("text-green-200", "border-transparent");
        btnDash.classList.remove("bg-unimed-green", "border-white");
        btnDash.classList.add("text-green-200", "border-transparent");
    } else {
        abaNova.classList.add("hidden");
        abaDash.classList.remove("hidden");
        btnDash.classList.add("bg-unimed-green", "border-white");
        btnDash.classList.remove("text-green-200", "border-transparent");
        btnNova.classList.remove("bg-unimed-green", "border-white");
        btnNova.classList.add("text-green-200", "border-transparent");

        carregarDashboardEHistorico();
    }
}

function carregarDashboardEHistorico() {
    const historico = JSON.parse(localStorage.getItem("unimed_historico_rondas") || "[]");

    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    const rondasMes = historico.filter(r => {
        const d = new Date(r.Data_Hora);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    document.getElementById("kpi-total-rondas").textContent = rondasMes.length;

    let totalAvaliados = 0;
    let totalConformes = 0;

    historico.forEach(r => {
        totalConformes += (r.Total_Conformes || 0);
        totalAvaliados += ((r.Total_Conformes || 0) + (r.Total_Nao_Conformes || 0));
    });

    const percentual = totalAvaliados > 0 ? Math.round((totalConformes / totalAvaliados) * 100) : 100;
    document.getElementById("kpi-indice-conformidade").textContent = `${percentual}%`;

    renderizarGraficosDashboard(historico);
    renderizarTabelaHistorico(historico);
}

function renderizarGraficosDashboard(historico) {
    const avariasPorUnidade = {};
    const avariasPorItem = {};

    historico.forEach(ronda => {
        if (ronda.Itens_Detalhados) {
            ronda.Itens_Detalhados.forEach(item => {
                if (item.Status === "Não Conforme") {
                    const qtdAvarias = item.Evidencias ? item.Evidencias.length : 1;
                    avariasPorUnidade[ronda.Unidade_Local] = (avariasPorUnidade[ronda.Unidade_Local] || 0) + qtdAvarias;
                    avariasPorItem[item.Nome_Item] = (avariasPorItem[item.Nome_Item] || 0) + qtdAvarias;
                }
            });
        }
    });

    if (chartUnidadesInstance) chartUnidadesInstance.destroy();
    if (chartItensInstance) chartItensInstance.destroy();

    const ctxUnidades = document.getElementById("chart-unidades").getContext("2d");
    chartUnidadesInstance = new Chart(ctxUnidades, {
        type: "bar",
        data: {
            labels: Object.keys(avariasPorUnidade).length > 0 ? Object.keys(avariasPorUnidade) : ["Sem registros"],
            datasets: [{
                label: "Quantidade de Avarias",
                data: Object.keys(avariasPorUnidade).length > 0 ? Object.values(avariasPorUnidade) : [0],
                backgroundColor: "#e11d48",
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    const ctxItens = document.getElementById("chart-itens").getContext("2d");
    chartItensInstance = new Chart(ctxItens, {
        type: "doughnut",
        data: {
            labels: Object.keys(avariasPorItem).length > 0 ? Object.keys(avariasPorItem) : ["Sem avarias"],
            datasets: [{
                data: Object.keys(avariasPorItem).length > 0 ? Object.values(avariasPorItem) : [1],
                backgroundColor: ["#e11d48", "#f97316", "#eab308", "#00995D", "#3b82f6", "#8b5cf6"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderizarTabelaHistorico(historico) {
    const tbody = document.getElementById("tabela-historico-body");
    tbody.innerHTML = "";

    if (historico.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Nenhuma ronda registrada ainda.</td></tr>`;
        return;
    }

    historico.forEach((r, index) => {
        const statusBadge = r.Total_Nao_Conformes > 0 
            ? `<span class="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">Com Avarias (${r.Total_Nao_Conformes})</span>`
            : `<span class="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">100% Conforme</span>`;

        const row = `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-3 text-xs">${r.Data_Hora}</td>
                <td class="p-3 text-xs font-bold text-gray-800">${r.Unidade_Local}</td>
                <td class="p-3 text-xs">${r.Inspetor}</td>
                <td class="p-3 text-xs text-center">${statusBadge}</td>
                <td class="p-3 text-xs text-center">
                    <button onclick="reemitirPDFHistorico(${index})" class="text-unimed-green hover:text-unimed-dark font-semibold text-xs flex items-center justify-center gap-1 mx-auto">
                        <i class="fa-solid fa-file-pdf"></i> PDF
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function filtrarHistorico() {
    const termo = document.getElementById("filtro-historico").value.toLowerCase();
    const historico = JSON.parse(localStorage.getItem("unimed_historico_rondas") || "[]");
    const filtrado = historico.filter(r => r.Unidade_Local.toLowerCase().includes(termo));
    renderizarTabelaHistorico(filtrado);
}


// ==============================================================================
// 7. GERAÇÃO DO RELATÓRIO PDF (html2pdf.js)
// ==============================================================================
function gerarPDFRelatorio() {
    gerarPDFApartirDeObjeto(
        estadoRonda.ID_Ronda, 
        estadoRonda.Unidade_Local, 
        estadoRonda.Inspetor, 
        document.getElementById("data-hora-ronda").value, 
        Object.values(estadoRonda.itens)
    );
}

function reemitirPDFHistorico(indexHistorico) {
    const historico = JSON.parse(localStorage.getItem("unimed_historico_rondas") || "[]");
    const r = historico[indexHistorico];
    if (!r) return;

    const itensFormatados = r.Itens_Detalhados.map(i => ({
        nome: i.Nome_Item,
        status: i.Status,
        evidencias: i.Evidencias || []
    }));

    gerarPDFApartirDeObjeto(r.ID_Ronda, r.Unidade_Local, r.Inspetor, r.Data_Hora, itensFormatados);
}

function gerarPDFApartirDeObjeto(idRonda, unidade, inspetor, dataHora, itens) {
    const template = document.getElementById("template-pdf");
    
    const naoConformes = itens.filter(i => i.status === "Não Conforme");

    let itensHTML = "";
    if (naoConformes.length === 0) {
        itensHTML = `<div class="p-4 bg-green-50 border border-green-200 text-green-800 rounded-md font-semibold text-center">Todos os itens de sinalização avaliados foram considerados CONFORMES.</div>`;
    } else {
        naoConformes.forEach((item, idx) => {
            let evidenciasHTML = "";
            
            if (item.evidencias && item.evidencias.length > 0) {
                item.evidencias.forEach((ev, evIdx) => {
                    evidenciasHTML += `
                        <div style="margin-top: 8px; padding: 8px; background-color: #f8fafc; border-left: 3px solid #e11d48; font-size: 11px;">
                            <div><strong>Evidência #${evIdx + 1} - Local:</strong> ${ev.Local || ev.local || 'Não informado'}</div>
                            <div><strong>Descrição:</strong> ${ev.Descricao || ev.descricao || 'Sem descrição'}</div>
                            ${(ev.Foto || ev.foto) ? `
                                <div style="margin-top: 5px;">
                                    <img src="${ev.Foto || ev.foto}" style="width: 130px; height: 90px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;">
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
            }

            itensHTML += `
                <div class="pdf-item-row" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
                    <div style="font-weight: bold; color: #e11d48; font-size: 13px;">${idx + 1}. ${item.nome}</div>
                    ${evidenciasHTML}
                </div>
            `;
        });
    }

    template.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <div style="border-bottom: 3px solid #00995D; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="color: #00995D; margin: 0; font-size: 20px;">Unimed Litoral</h2>
                    <h4 style="color: #555; margin: 2px 0 0 0; font-size: 14px;">Relatório de Avarias e Não Conformidades</h4>
                </div>
                <div style="text-align: right; font-size: 11px; color: #777;">
                    <div>ID: ${idRonda}</div>
                    <div>Emissão: ${dataHora}</div>
                </div>
            </div>

            <div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 12px;">
                <div><strong>Unidade / Local:</strong> ${unidade}</div>
                <div><strong>Inspetor Responsável:</strong> ${inspetor}</div>
            </div>

            <h3 style="font-size: 14px; color: #1e293b; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">
                Detalhamento dos Itens com Avaria
            </h3>

            ${itensHTML}

            <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; text-align: center; font-size: 10px; color: #999;">
                Sistema de Rondas de Sinalização - Unimed Litoral
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Relatorio_Avarias_${unidade.replace(/\s+/g, '_')}_${idRonda}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(template).save();
}
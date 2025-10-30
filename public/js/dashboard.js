// Variáveis globais
let instances = [];
let apiToken = '';

// Gerenciamento de token no cliente
function getStoredToken() {
    try {
        return localStorage.getItem('apiToken') || '';
    } catch (e) {
        return '';
    }
}

function setStoredToken(token) {
    try {
        localStorage.setItem('apiToken', token);
    } catch (e) {
        // ignore
    }
}

function clearStoredToken() {
    try {
        localStorage.removeItem('apiToken');
    } catch (e) {
        // ignore
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando dashboard...');
    
    // GARANTIR que o loading seja escondido em 3 segundos NO MÁXIMO
    setTimeout(() => {
        console.log('⏰ FORÇANDO esconder loading após 3 segundos');
        forceHideAllLoading();
    }, 3000);
    
    // Configurar event listeners
    setupEventListeners();
    
    // Exigir token antes de prosseguir
    ensureToken().then(() => {
        console.log('✅ Token disponível, carregando instâncias...');
        loadInstances();
    });
});

// Configurar event listeners
function setupEventListeners() {
    // Botão Nova Instância
    const newInstanceBtn = document.getElementById('newInstanceBtn');
    if (newInstanceBtn) {
        newInstanceBtn.addEventListener('click', showCreateInstanceModal);
    }
    
    // Botão Atualizar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshInstances);
    }
    
    // Botão Criar Instância
    const createInstanceBtn = document.getElementById('createInstanceBtn');
    if (createInstanceBtn) {
        createInstanceBtn.addEventListener('click', createInstance);
    }
    
    // Botão Conectar Instância
    const connectInstanceBtn = document.getElementById('connectInstanceBtn');
    if (connectInstanceBtn) {
        connectInstanceBtn.addEventListener('click', connectInstance);
    }
    
    // Botão Copiar Token
    const copyTokenBtn = document.getElementById('copyTokenBtn');
    if (copyTokenBtn) {
        copyTokenBtn.addEventListener('click', copyToken);
    }
    
    // Botão Mostrar Token
    const showApiTokenBtn = document.getElementById('showApiTokenBtn');
    if (showApiTokenBtn) {
        showApiTokenBtn.addEventListener('click', showApiToken);
    }
    
    // Botão Atualizar (menu)
    const refreshInstancesBtn = document.getElementById('refreshInstancesBtn');
    if (refreshInstancesBtn) {
        refreshInstancesBtn.addEventListener('click', refreshInstances);
    }
    
    // Botão Forçar Parar
    const forceStopBtn = document.getElementById('forceStopBtn');
    if (forceStopBtn) {
        forceStopBtn.addEventListener('click', forceHideAllLoading);
    }
    
    console.log('✅ Event listeners configurados');
}

// Garantir que o token seja informado pelo usuário
function ensureToken() {
    return new Promise((resolve) => {
        const existing = getStoredToken();
        if (existing) {
            apiToken = existing;
            return resolve();
        }

        const modalEl = document.getElementById('apiTokenModal');
        const modal = new bootstrap.Modal(modalEl);
        const input = document.getElementById('apiTokenInput');
        const saveBtn = document.getElementById('saveApiTokenBtn');
        const clearBtn = document.getElementById('clearTokenBtn');

        input.value = '';

        function trySave() {
            const value = (input.value || '').trim();
            if (!value) {
                showError('Informe um token válido');
                return;
            }
            apiToken = value;
            setStoredToken(value);
            saveBtn.removeEventListener('click', trySave);
            input.removeEventListener('keydown', onKey);
            clearBtn?.removeEventListener('click', onClear);
            modal.hide();
            resolve();
        }

        function onKey(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                trySave();
            }
        }

        function onClear() {
            clearStoredToken();
            input.value = '';
            input.focus();
        }

        saveBtn.addEventListener('click', trySave);
        input.addEventListener('keydown', onKey);
        if (clearBtn) clearBtn.addEventListener('click', onClear);
        modal.show();
    });
}

// Carregar instâncias
async function loadInstances() {
    console.log('🔄 Carregando instâncias...');
    showLoading();
    
    try {
        if (!apiToken) {
            console.warn('⚠️ Token não disponível, usando token padrão');
            apiToken = 'instagram-manager-token';
        }
        
        console.log('🔑 Usando token:', apiToken.substring(0, 20) + '...');
        
        // Timeout de 5 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('⏰ Timeout de 5 segundos atingido');
            controller.abort();
        }, 5000);
        
        const response = await fetch('/api/instances', {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('📡 Resposta da API:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erro da API:', errorData);
            if (response.status === 401) {
                showError('Token inválido ou ausente. Informe o token novamente.');
                await promptForTokenAndRetry();
                return; // interrompe fluxo atual; nova tentativa acontecerá
            }
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Dados recebidos:', data);
        
        instances = data.instances || [];
        console.log(`✅ ${instances.length} instâncias carregadas`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar instâncias:', error);
        // Não sobrescrever as instâncias já carregadas em caso de erro de rede/API
        // Mantemos o último estado conhecido para não zerar os contadores
        
        if (error.name === 'AbortError') {
            console.log('⏰ Timeout atingido - continuando sem dados');
        } else if (error.message.includes('Failed to fetch')) {
            console.log('🌐 Erro de conexão - servidor pode estar offline');
        } else {
            console.log('❌ Erro:', error.message);
        }
    } finally {
        // SEMPRE esconder loading e renderizar interface
        console.log('🎨 Renderizando interface...');
        renderInstances();
        updateStatistics();
        hideLoading();
        console.log('✅ Interface carregada!');
    }
}

async function promptForTokenAndRetry() {
    await new Promise((resolve) => {
        const modalEl = document.getElementById('apiTokenModal');
        const modal = new bootstrap.Modal(modalEl);
        const input = document.getElementById('apiTokenInput');
        const saveBtn = document.getElementById('saveApiTokenBtn');
        const clearBtn = document.getElementById('clearTokenBtn');

        input.value = '';

        function trySave() {
            const value = (input.value || '').trim();
            if (!value) {
                showError('Informe um token válido');
                return;
            }
            apiToken = value;
            setStoredToken(value);
            saveBtn.removeEventListener('click', trySave);
            input.removeEventListener('keydown', onKey);
            clearBtn?.removeEventListener('click', onClear);
            modal.hide();
            resolve();
        }

        function onKey(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                trySave();
            }
        }

        function onClear() {
            clearStoredToken();
            input.value = '';
            input.focus();
        }

        saveBtn.addEventListener('click', trySave);
        input.addEventListener('keydown', onKey);
        if (clearBtn) clearBtn.addEventListener('click', onClear);
        modal.show();
    });

    // Depois que o usuário salvar, tentar novamente
    loadInstances();
}

// Renderizar lista de instâncias
function renderInstances() {
    const container = document.getElementById('instancesList');
    if (!container) return;

    if (instances.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="card text-center py-5">
                    <div class="card-body">
                        <i class="fas fa-plus-circle fa-3x text-muted mb-3"></i>
                        <h5 class="card-title">Nenhuma instância criada</h5>
                        <p class="card-text">Clique no botão "Nova Instância" para começar</p>
                        <button class="btn btn-primary" id="newInstanceEmptyBtn">
                            <i class="fas fa-plus"></i> Nova Instância
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = instances.map(instance => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${escapeHtml(instance.name)}</h6>
                    <span class="badge bg-${instance.status === 'connected' ? 'success' : 'secondary'}">
                        ${instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                </div>
                <div class="card-body">
                    <p class="card-text">
                        <strong>Username:</strong> ${escapeHtml(instance.username)}<br>
                        <strong>Criado em:</strong> ${new Date(instance.createdAt).toLocaleDateString('pt-BR')}<br>
                        <strong>Última atividade:</strong> ${instance.lastActivity ? new Date(instance.lastActivity).toLocaleDateString('pt-BR') : 'Nunca'}
                    </p>
                </div>
                <div class="card-footer">
                    <div class="btn-group w-100" role="group">
                        ${instance.status === 'connected' ? 
                            `<button class="btn btn-warning btn-sm disconnect-btn" data-instance-id="${instance.id}">
                                <i class="fas fa-unlink"></i> Desconectar
                            </button>` :
                            `<button class="btn btn-success btn-sm connect-btn" data-instance-id="${instance.id}">
                                <i class="fas fa-link"></i> Conectar
                            </button>`
                        }
                        <button class="btn btn-danger btn-sm delete-btn" data-instance-id="${instance.id}">
                            <i class="fas fa-trash"></i> Deletar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Adicionar event listeners para botões dinâmicos
    setupDynamicEventListeners();
}

// Configurar event listeners para elementos dinâmicos
function setupDynamicEventListeners() {
    // Botão Nova Instância (quando não há instâncias)
    const newInstanceEmptyBtn = document.getElementById('newInstanceEmptyBtn');
    if (newInstanceEmptyBtn) {
        newInstanceEmptyBtn.addEventListener('click', showCreateInstanceModal);
    }
    
    // Botões de instâncias
    document.querySelectorAll('.connect-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const instanceId = e.target.closest('.connect-btn').dataset.instanceId;
            showConnectModal(instanceId);
        });
    });
    
    document.querySelectorAll('.disconnect-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const instanceId = e.target.closest('.disconnect-btn').dataset.instanceId;
            disconnectInstance(instanceId);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const instanceId = e.target.closest('.delete-btn').dataset.instanceId;
            deleteInstance(instanceId);
        });
    });
}

// Atualizar estatísticas
function updateStatistics() {
    // Considerar apenas instâncias ativas, quando a flag existir
    const activeInstances = instances.filter(i => i.isActive !== false);
    const total = activeInstances.length;
    const connected = activeInstances.filter(i => i.status === 'connected').length;
    const disconnected = Math.max(total - connected, 0);

    document.getElementById('totalInstances').textContent = total;
    document.getElementById('connectedInstances').textContent = connected;
    document.getElementById('disconnectedInstances').textContent = disconnected;
}

// Mostrar modal de criação de instância
function showCreateInstanceModal() {
    document.getElementById('instanceName').value = '';
    document.getElementById('instanceUsername').value = '';
    document.getElementById('instancePassword').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('createInstanceModal'));
    modal.show();
}

// Mostrar modal de conexão
function showConnectModal(instanceId) {
    const instanceIdInput = document.getElementById('connectInstanceId');
    if (instanceIdInput) {
        instanceIdInput.value = instanceId;
    }
    
    const passwordInput = document.getElementById('connectPassword');
    if (passwordInput) {
        passwordInput.value = '';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('connectInstanceModal'));
    modal.show();
}

// Criar instância
async function createInstance() {
    const name = document.getElementById('instanceName').value.trim();
    const username = document.getElementById('instanceUsername').value.trim();
    const password = document.getElementById('instancePassword').value;

    if (!name || !username || !password) {
        showError('Todos os campos são obrigatórios');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch('/api/instances', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({ name, username, password })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('Instância criada com sucesso!');
            bootstrap.Modal.getInstance(document.getElementById('createInstanceModal')).hide();
            loadInstances();
        } else {
            showError(data.error || 'Erro ao criar instância');
        }
    } catch (error) {
        console.error('Erro ao criar instância:', error);
        showError('Erro ao criar instância: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Conectar instância
async function connectInstance() {
    const instanceId = document.getElementById('connectInstanceId').value;
    const password = document.getElementById('connectPassword').value;

    if (!password) {
        showError('Senha é obrigatória');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch(`/api/instances/${instanceId}/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('Instância conectada com sucesso!');
            bootstrap.Modal.getInstance(document.getElementById('connectInstanceModal')).hide();
            loadInstances();
        } else {
            showError(data.error || 'Erro ao conectar instância');
        }
    } catch (error) {
        console.error('Erro ao conectar instância:', error);
        showError('Erro ao conectar instância: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Desconectar instância
async function disconnectInstance(instanceId) {
    if (!confirm('Tem certeza que deseja desconectar esta instância?')) {
        return;
    }

    try {
        showLoading();
        
        const response = await fetch(`/api/instances/${instanceId}/disconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('Instância desconectada com sucesso!');
            loadInstances();
        } else {
            showError(data.error || 'Erro ao desconectar instância');
        }
    } catch (error) {
        console.error('Erro ao desconectar instância:', error);
        showError('Erro ao desconectar instância: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Deletar instância
async function deleteInstance(instanceId) {
    if (!confirm('Tem certeza que deseja deletar esta instância? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        showLoading();
        
        const response = await fetch(`/api/instances/${instanceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccess('Instância deletada com sucesso!');
            loadInstances();
        } else {
            showError(data.error || 'Erro ao deletar instância');
        }
    } catch (error) {
        console.error('Erro ao deletar instância:', error);
        showError('Erro ao deletar instância: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Mostrar token da API
function showApiToken() {
    const input = document.getElementById('apiTokenInput');
    const modal = new bootstrap.Modal(document.getElementById('apiTokenModal'));
    const stored = getStoredToken();
    input.value = stored || '';
    modal.show();
}

// Copiar token para área de transferência
function copyToken() { /* não utilizado com novo modal */ }

// Atualizar instâncias
function refreshInstances() {
    loadInstances();
}

// Função para FORÇAR remoção de TODOS os spinners
function forceHideAllLoading() {
    console.log('🔥 FORÇANDO remoção de TODOS os spinners...');
    
    // 1. Esconder loadingOverlay específico
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.remove(); // REMOVER COMPLETAMENTE
        console.log('✅ loadingOverlay removido');
    }
    
    // 2. Esconder TODOS os elementos com "loading" no ID ou classe
    const loadingElements = document.querySelectorAll('[id*="loading"], [class*="loading"], [class*="spinner"], [class*="overlay"]');
    loadingElements.forEach((el, index) => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.zIndex = '-9999';
        console.log(`✅ Elemento ${index + 1} escondido:`, el);
    });
    
    // 3. Esconder TODOS os elementos com spinner-border
    const spinners = document.querySelectorAll('.spinner-border, .spinner-grow, .spinner');
    spinners.forEach((el, index) => {
        el.style.display = 'none';
        el.remove(); // REMOVER COMPLETAMENTE
        console.log(`✅ Spinner ${index + 1} removido`);
    });
    
    // 4. Esconder TODOS os elementos com position fixed que podem ser overlays
    const fixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
    fixedElements.forEach((el, index) => {
        if (el.style.zIndex && parseInt(el.style.zIndex) > 1000) {
            el.style.display = 'none';
            console.log(`✅ Overlay fixo ${index + 1} escondido`);
        }
    });
    
    // 5. Garantir que o body não tenha overflow hidden
    document.body.style.overflow = 'auto';
    document.body.style.pointerEvents = 'auto';
    
    console.log('🎉 TODOS os spinners foram FORÇADOS a desaparecer!');
}

// Funções de utilidade
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        console.log('🔄 Loading mostrado');
    } else {
        console.warn('⚠️ Elemento loadingOverlay não encontrado');
    }
}

function hideLoading() {
    console.log('🔄 Tentando esconder loading...');
    forceHideAllLoading();
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    notification.innerHTML = `
        ${icon} ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Função para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
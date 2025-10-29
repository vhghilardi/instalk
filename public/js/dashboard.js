// Dashboard JavaScript
let currentThreadId = null;
let selectedUser = null;

// Funções de utilidade
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showAlert(message, type = 'info') {
    // Remove alertas existentes
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Cria novo alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} fade-in`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    // Insere no topo da página
    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Remove após 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Buscar usuário
async function searchUser() {
    const username = document.getElementById('searchUsername').value.trim();
    if (!username) {
        showAlert('Digite um username para buscar!', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/api/search-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
            displayUserResult(data.user);
            selectedUser = data.user;
        } else {
            document.getElementById('userSearchResult').innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-user-slash"></i>
                    Usuário não encontrado: @${username}
                </div>
            `;
            selectedUser = null;
        }
    } catch (error) {
        showAlert('Erro ao buscar usuário: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

function displayUserResult(user) {
    const resultDiv = document.getElementById('userSearchResult');
    resultDiv.innerHTML = `
        <div class="user-result selected" onclick="selectUser('${user.username}')">
            <div class="d-flex align-items-center">
                ${user.profile_pic_url ? 
                    `<img src="${user.profile_pic_url}" class="rounded-circle me-3" width="40" height="40">` :
                    `<div class="bg-secondary rounded-circle me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                        <i class="fas fa-user text-white"></i>
                    </div>`
                }
                <div>
                    <h6 class="mb-1">${user.full_name}</h6>
                    <p class="mb-0 text-muted">@${user.username}</p>
                    <small class="text-muted">
                        ${user.follower_count} seguidores • 
                        ${user.is_private ? 'Privado' : 'Público'}
                    </small>
                </div>
            </div>
        </div>
    `;
}

function selectUser(username) {
    document.getElementById('searchUsername').value = username;
    selectedUser = { username };
}

// Enviar mensagem para usuário
async function sendMessageToUser() {
    const username = document.getElementById('searchUsername').value.trim();
    const message = document.getElementById('messageText').value.trim();
    
    if (!username) {
        showAlert('Selecione um usuário primeiro!', 'warning');
        return;
    }
    
    if (!message) {
        showAlert('Digite uma mensagem!', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: username,
                message: message,
                type: 'username'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`Mensagem enviada com sucesso para @${username}!`, 'success');
            document.getElementById('messageText').value = '';
        } else {
            showAlert('Erro ao enviar mensagem: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Erro ao enviar mensagem: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Enviar mensagem para thread
async function sendMessageToThread() {
    const threadId = document.getElementById('threadId').value.trim();
    const message = document.getElementById('messageText').value.trim();
    
    if (!threadId) {
        showAlert('Digite um Thread ID!', 'warning');
        return;
    }
    
    if (!message) {
        showAlert('Digite uma mensagem!', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: threadId,
                message: message,
                type: 'thread'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Mensagem enviada com sucesso!', 'success');
            document.getElementById('messageText').value = '';
            
            // Se é a conversa atual, atualizar mensagens
            if (currentThreadId === threadId) {
                setTimeout(() => refreshCurrentConversation(), 1000);
            }
        } else {
            showAlert('Erro ao enviar mensagem: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Erro ao enviar mensagem: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Selecionar conversa
function selectConversation(threadId, participants) {
    // Validar threadId rigorosamente
    if (!threadId || threadId === 'undefined' || threadId === 'null' || threadId.trim() === '') {
        showAlert('Erro: Thread ID inválido. Selecione uma conversa válida.', 'danger');
        console.error('ThreadId inválido recebido:', threadId);
        return;
    }
    
    // Tentar pegar do data attribute se o parâmetro estiver inválido
    const clickedElement = event.target.closest('.conversation-item');
    const dataThreadId = clickedElement ? clickedElement.getAttribute('data-thread-id') : null;
    
    const finalThreadId = (threadId && threadId !== 'undefined' && threadId !== 'null') ? threadId : dataThreadId;
    
    if (!finalThreadId || finalThreadId === 'undefined' || finalThreadId === 'null') {
        showAlert('Erro: Não foi possível obter o Thread ID válido desta conversa.', 'danger');
        console.error('Não foi possível obter threadId válido');
        return;
    }
    
    // Remover seleção anterior
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Adicionar seleção atual
    if (clickedElement) {
        clickedElement.classList.add('active');
    }
    
    currentThreadId = finalThreadId;
    document.getElementById('threadId').value = finalThreadId;
    document.getElementById('conversationTitle').innerHTML = `
        <i class="fas fa-comment-dots"></i> Conversa com: ${participants || 'Desconhecido'}
    `;
    document.getElementById('refreshMessages').style.display = 'inline-block';
    
    console.log('Carregando mensagens para thread:', finalThreadId);
    loadMessages(finalThreadId);
}

// Carregar mensagens
async function loadMessages(threadId) {
    // Validar threadId
    if (!threadId || threadId === 'undefined' || threadId.trim() === '') {
        document.getElementById('messagesArea').innerHTML = `
            <div class="text-center text-danger">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <p>Thread ID inválido. Selecione uma conversa válida.</p>
            </div>
        `;
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`/api/thread/${encodeURIComponent(threadId)}/messages?limit=50`);
        const data = await response.json();
        
        if (data.success) {
            displayMessages(data.messages);
        } else {
            document.getElementById('messagesArea').innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Erro ao carregar mensagens: ${data.error}</p>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('messagesArea').innerHTML = `
            <div class="text-center text-danger">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <p>Erro ao carregar mensagens: ${error.message}</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

function displayMessages(messages) {
    const messagesArea = document.getElementById('messagesArea');
    
    if (messages.length === 0) {
        messagesArea.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-comment-slash fa-2x mb-3"></i>
                <p>Nenhuma mensagem encontrada</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    messages.forEach(message => {
        const bubbleClass = message.is_from_me ? 'message-from-me' : 'message-from-other';
        html += `
            <div class="d-flex ${message.is_from_me ? 'justify-content-end' : 'justify-content-start'} mb-2">
                <div class="message-bubble ${bubbleClass}">
                    <div>${escapeHtml(message.text)}</div>
                    <div class="message-time">${message.formatted_time}</div>
                </div>
            </div>
        `;
    });
    
    messagesArea.innerHTML = html;
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Atualizar conversa atual
function refreshCurrentConversation() {
    if (currentThreadId) {
        loadMessages(currentThreadId);
    }
}

// Mostrar informações do usuário
function showUserInfo() {
    const modal = new bootstrap.Modal(document.getElementById('userInfoModal'));
    modal.show();
}

// Logout
async function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        showLoading();
        
        try {
            const response = await fetch('/logout', {
                method: 'POST'
            });
            
            if (response.ok) {
                window.location.href = '/';
            } else {
                showAlert('Erro ao fazer logout', 'danger');
            }
        } catch (error) {
            showAlert('Erro ao fazer logout: ' + error.message, 'danger');
        } finally {
            hideLoading();
        }
    }
}

// Função para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Enter para buscar usuário
    document.getElementById('searchUsername').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchUser();
        }
    });
    
    // Enter para enviar mensagem (Ctrl+Enter para quebra de linha)
    document.getElementById('messageText').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.ctrlKey) {
            e.preventDefault();
            if (currentThreadId) {
                sendMessageToThread();
            } else {
                sendMessageToUser();
            }
        }
    });
    
    // Auto-refresh das conversas a cada 30 segundos
    setInterval(() => {
        if (currentThreadId) {
            refreshCurrentConversation();
        }
    }, 30000);
});


const { randomUUID } = require('crypto');
const InstagramAuth = require('./auth');
const InstagramMessaging = require('./messaging');

class InstanceManager {
    constructor(database) {
        this.database = database;
        this.instances = new Map(); // Cache de instâncias ativas
        this.webhookUrl = process.env.WEBHOOK_URL || null;
        this.inboxPollers = new Map(); // instanceId -> intervalId
        this.lastSeenMessageIds = new Map(); // instanceId -> Set<string>
    }

    // Obter todas as instâncias
    async getAllInstances() {
        try {
            console.log('🔄 Carregando todas as instâncias...');
            const instances = await this.database.getInstances();
            const result = [];

            console.log(`📊 Processando ${instances.length} instâncias do banco...`);
            for (const instanceData of instances) {
                const instance = await this.getInstance(instanceData.id);
                result.push(instance);
            }

            console.log(`✅ Total de instâncias carregadas: ${result.length}`);
            return result;
        } catch (error) {
            console.error('❌ Erro ao carregar instâncias:', error);
            throw error;
        }
    }

    // Obter instância específica
    async getInstance(instanceId) {
        try {
            // Verificar cache primeiro
            if (this.instances.has(instanceId)) {
                return this.instances.get(instanceId);
            }

            // Buscar no banco de dados
            const instanceData = await this.database.getInstance(instanceId);
            if (!instanceData) {
                return null;
            }

            const instance = {
                id: instanceData.id,
                name: instanceData.name,
                username: instanceData.username,
                status: instanceData.status,
                createdAt: instanceData.created_at,
                lastActivity: instanceData.last_activity,
                isActive: instanceData.is_active,
                metadata: instanceData.metadata ? JSON.parse(instanceData.metadata) : {}
            };

            // Adicionar ao cache
            this.instances.set(instanceId, instance);
            return instance;
        } catch (error) {
            console.error(`❌ Erro ao obter instância ${instanceId}:`, error);
            throw error;
        }
    }

    // Criar nova instância
    async createInstance(name, username, password) {
        try {
            const instanceId = randomUUID();
            
            // Criar no banco de dados com senha
            const createResult = await this.database.createInstance(name, username, password);
            const actualInstanceId = createResult.instanceId;
            
            // Tentar conectar automaticamente
            const connectResult = await this.connectInstance(actualInstanceId, password);
            
            const instance = {
                id: actualInstanceId,
                name: name,
                username: username,
                status: connectResult.success ? 'connected' : 'disconnected',
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                isActive: true,
                metadata: {}
            };

            // Adicionar ao cache
            this.instances.set(actualInstanceId, instance);
            
            console.log(`✅ Instância criada: ${name} (${username})`);
            return instance;
        } catch (error) {
            console.error('❌ Erro ao criar instância:', error);
            throw error;
        }
    }

    // Conectar instância
    async connectInstance(instanceId, password) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            // Criar autenticação Instagram
            const auth = new InstagramAuth();
            const loginResult = await auth.login(instance.username, password);
            
            if (loginResult.success) {
                // Criar cliente de mensagens
                const messaging = new InstagramMessaging(auth.getIgClient());
                
                // Atualizar status e senha no banco
                await this.database.updateInstanceStatus(instanceId, 'connected');
                await this.database.updateInstancePassword(instanceId, password);
                
                // Atualizar cache
                instance.status = 'connected';
                instance.lastActivity = new Date().toISOString();
                this.instances.set(instanceId, instance);
                
                // Iniciar polling do inbox para webhook
                this.startInboxPolling(instanceId);

                console.log(`✅ Instância conectada: ${instance.name}`);
                return { success: true, message: 'Instância conectada com sucesso' };
            } else {
                await this.database.updateInstanceStatus(instanceId, 'disconnected');
                instance.status = 'disconnected';
                this.instances.set(instanceId, instance);
                
                return { success: false, message: loginResult.message };
            }
        } catch (error) {
            console.error(`❌ Erro ao conectar instância ${instanceId}:`, error);
            return { success: false, message: error.message };
        }
    }

    // Desconectar instância
    async disconnectInstance(instanceId) {
        try {
            await this.database.updateInstanceStatus(instanceId, 'disconnected');
            
            // Atualizar cache
            const instance = await this.getInstance(instanceId);
            if (instance) {
                instance.status = 'disconnected';
                this.instances.set(instanceId, instance);
            }
            
            // Parar polling do inbox
            this.stopInboxPolling(instanceId);
            
            console.log(`✅ Instância desconectada: ${instanceId}`);
            return { success: true, message: 'Instância desconectada com sucesso' };
        } catch (error) {
            console.error(`❌ Erro ao desconectar instância ${instanceId}:`, error);
            return { success: false, message: error.message };
        }
    }

    // Deletar instância
    async deleteInstance(instanceId) {
        try {
            await this.database.deleteInstance(instanceId);
            
            // Remover do cache
            this.instances.delete(instanceId);
            
            console.log(`✅ Instância deletada: ${instanceId}`);
            return { success: true, message: 'Instância deletada com sucesso' };
        } catch (error) {
            console.error(`❌ Erro ao deletar instância ${instanceId}:`, error);
            return { success: false, message: error.message };
        }
    }

    // === Webhook: polling de novas mensagens recebidas ===
    startInboxPolling(instanceId) {
        if (!this.webhookUrl) {
            console.log('ℹ️ WEBHOOK_URL não configurado. Polling não iniciado.');
            return;
        }
        if (this.inboxPollers.has(instanceId)) {
            return; // já ativo
        }

        const pollIntervalMs = 15000; // 15s
        const runner = async () => {
            try {
                const startedAt = new Date();
                console.log(`[Webhook][${instanceId}] ▶️ Poll tick iniciado às ${startedAt.toISOString()}`);
                const instance = await this.getInstance(instanceId);
                if (!instance || instance.status !== 'connected') return;

                const instanceData = await this.database.getInstance(instanceId);
                if (!instanceData || !instanceData.password) return;

                const InstagramAuth = require('./auth');
                const auth = new InstagramAuth();
                const loginResult = await auth.login(instanceData.username, instanceData.password);
                if (!loginResult.success) return;

                const InstagramMessaging = require('./messaging');
                const messaging = new InstagramMessaging(auth.getIgClient());
                const inbox = await messaging.getDirectMessages(50); // retorna threads
                console.log(`[Webhook][${instanceId}] 📥 Threads obtidos: ${inbox.length}`);

                const seen = this.getSeenSet(instanceId);

                for (const thread of inbox) {
                    const lastItem = thread.last_permanent_item;
                    if (!lastItem || !lastItem.item_id) continue;
                    const messageId = String(lastItem.item_id);
                    if (seen.has(messageId)) {
                        // Mensagem já processada anteriormente
                        // console.log(`[Webhook][${instanceId}] ⏩ Ignorando mensagem já vista: ${messageId}`);
                        continue;
                    }

                    // Marcar como visto antes de postar para evitar duplicatas em caso de lentidão
                    seen.add(messageId);

                    const payload = this.buildWebhookPayload(instance, thread, lastItem);
                    console.log(`[Webhook][${instanceId}] 🔔 Nova mensagem detectada -> thread=${payload.thread.id} msg=${payload.message.id} tipo=${payload.message.type}`);
                    try {
                        const payloadPreview = JSON.stringify(payload);
                        console.log(`[Webhook][${instanceId}] 📦 Payload a enviar: ${payloadPreview}`);
                    } catch (_) {
                        console.log(`[Webhook][${instanceId}] 📦 Payload a enviar: [object não serializável]`);
                    }
                    await this.postToWebhook(payload);
                }

                // Limitar crescimento do set
                if (seen.size > 1000) {
                    // manter só os 500 mais recentes: recriar set
                    const trimmed = Array.from(seen).slice(-500);
                    this.lastSeenMessageIds.set(instanceId, new Set(trimmed));
                    console.log(`[Webhook][${instanceId}] 🧹 Limpeza do cache de mensagens vistas (tamanho atual=${trimmed.length})`);
                }
                const finishedAt = new Date();
                console.log(`[Webhook][${instanceId}] ✅ Poll tick concluído em ${(finishedAt - startedAt)}ms`);
            } catch (err) {
                console.warn(`⚠️ Polling inbox falhou para ${instanceId}:`, err.message);
            }
        };

        const intervalId = setInterval(runner, pollIntervalMs);
        this.inboxPollers.set(instanceId, intervalId);
        // Executa uma vez imediatamente
        runner();
        console.log(`▶️ Polling de inbox iniciado para instância ${instanceId} (intervalo=${pollIntervalMs}ms)`);
    }

    stopInboxPolling(instanceId) {
        const intervalId = this.inboxPollers.get(instanceId);
        if (intervalId) {
            clearInterval(intervalId);
            this.inboxPollers.delete(instanceId);
            console.log(`⏹️ Polling de inbox parado para instância ${instanceId}`);
        }
    }

    getSeenSet(instanceId) {
        if (!this.lastSeenMessageIds.has(instanceId)) {
            this.lastSeenMessageIds.set(instanceId, new Set());
        }
        return this.lastSeenMessageIds.get(instanceId);
    }

    buildWebhookPayload(instance, thread, lastItem) {
        const participants = (thread.users || []).map(u => ({
            id: String(u.pk || u.id || ''),
            username: u.username,
            fullName: u.full_name,
            profilePicUrl: u.profile_pic_url
        }));
        const tsNum = Number(lastItem.timestamp || thread.last_activity_at || Date.now());
        const timestamp = tsNum > 10000000000000 ? new Date(tsNum / 1000).toISOString()
                        : tsNum > 1000000000000 ? new Date(tsNum).toISOString()
                        : new Date(tsNum * 1000).toISOString();
        return {
            event: 'instagram.new_message',
            instance: {
                id: instance.id,
                name: instance.name,
                username: instance.username
            },
            thread: {
                id: String(thread.thread_id || thread.id || ''),
                participants
            },
            message: {
                id: String(lastItem.item_id || lastItem.id || ''),
                type: lastItem.item_type || 'text',
                text: lastItem.text || null,
                timestamp,
                userId: String(lastItem.user_id || '')
            }
        };
    }

    async postToWebhook(payload) {
        try {
            const url = this.webhookUrl;
            if (!url) return;

            const { URL } = require('url');
            const parsed = new URL(url);
            const isHttps = parsed.protocol === 'https:';
            const mod = isHttps ? require('https') : require('http');

            const body = JSON.stringify(payload);
            const options = {
                method: 'POST',
                hostname: parsed.hostname,
                port: parsed.port || (isHttps ? 443 : 80),
                path: parsed.pathname + (parsed.search || ''),
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            await new Promise((resolve, reject) => {
                const req = mod.request(options, res => {
                    const status = res.statusCode || 0;
                    let responseBody = '';
                    res.on('data', (chunk) => { responseBody += chunk.toString(); });
                    res.on('end', () => {
                        if (status >= 200 && status < 300) {
                            console.log(`📨 Webhook OK (status=${status})`);
                        } else {
                            console.warn(`⚠️ Webhook respondeu com status ${status}: ${responseBody?.slice(0, 200)}`);
                        }
                        resolve();
                    });
                });
                req.on('error', (e) => {
                    console.warn('⚠️ Erro ao enviar webhook (requisição):', e.message);
                    reject(e);
                });
                req.write(body);
                req.end();
            });
            // sucesso já logado acima pelo status 2xx
        } catch (err) {
            console.warn('⚠️ Falha ao enviar webhook:', err.message);
        }
    }

    // Enviar mensagem
    async sendMessage(instanceId, recipient, message) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            // Buscar dados da instância no banco para obter credenciais
            const instanceData = await this.database.getInstance(instanceId);
            if (!instanceData) {
                throw new Error('Dados da instância não encontrados');
            }

            if (!instanceData.password) {
                throw new Error('Senha da instância não encontrada. Reconecte a instância.');
            }

            // Criar nova autenticação para esta instância
            const auth = new InstagramAuth();
            const loginResult = await auth.login(instanceData.username, instanceData.password);
            
            if (!loginResult.success) {
                throw new Error(`Falha na autenticação: ${loginResult.message}`);
            }

            // Criar cliente de mensagens
            const messaging = new InstagramMessaging(auth.getIgClient());
            
            // Buscar e enviar mensagem diretamente
            const recipientStr = String(recipient).replace('@', '').trim();
            console.log(`📤 Enviando mensagem para: ${recipientStr}`);
            
            // Buscar usuário usando a API do Instagram diretamente
            const igClient = auth.getIgClient();
            const user = await igClient.user.searchExact(recipientStr);
            
            if (!user || !user.pk) {
                throw new Error(`Usuário ${recipientStr} não encontrado`);
            }
            
            console.log(`✅ Usuário encontrado: ${user.username} (PK: ${user.pk})`);
            
            // Enviar mensagem diretamente
            const thread = igClient.entity.directThread([user.pk.toString()]);
            await thread.broadcastText(message);
            
            console.log(`✅ Mensagem enviada com sucesso!`);
            const sendResult = { success: true, message: 'Mensagem enviada' };
            
            if (sendResult.success) {
                console.log(`📤 Mensagem enviada via ${instance.name}: ${recipient} - ${message}`);
                
                // Atualizar última atividade da instância
                await this.database.updateInstanceStatus(instanceId, 'connected');
                
                return { 
                    success: true, 
                    message: 'Mensagem enviada com sucesso',
                    messageId: sendResult.messageId || null
                };
            } else {
                throw new Error(`Falha ao enviar mensagem: ${sendResult.message}`);
            }
        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem via ${instanceId}:`, error);
            console.error(`❌ Stack trace:`, error.stack);
            return { success: false, message: error.message };
        }
    }

    // Obter conversas
    async getConversations(instanceId) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            // Buscar dados da instância no banco para obter credenciais
            const instanceData = await this.database.getInstance(instanceId);
            if (!instanceData) {
                throw new Error('Dados da instância não encontrados');
            }

            if (!instanceData.password) {
                throw new Error('Senha da instância não encontrada. Reconecte a instância.');
            }

            // Criar nova autenticação para esta instância
            const auth = new InstagramAuth();
            const loginResult = await auth.login(instanceData.username, instanceData.password);
            
            if (!loginResult.success) {
                throw new Error(`Falha na autenticação: ${loginResult.message}`);
            }

            // Criar cliente de mensagens
            const messaging = new InstagramMessaging(auth.getIgClient());
            
            // Buscar conversas usando a API do Instagram
            const conversations = await messaging.getDirectMessages(50);
            
            // Formatar conversas para o frontend
            const formattedConversations = conversations.map(thread => {
                // Função para converter timestamp de forma segura
                const safeTimestamp = (timestamp) => {
                    if (!timestamp) return null;
                    try {
                        const date = new Date(timestamp * 1000);
                        return isNaN(date.getTime()) ? null : date.toISOString();
                    } catch (error) {
                        console.warn('Erro ao converter timestamp:', timestamp, error);
                        return null;
                    }
                };

                return {
                    id: thread.thread_id,
                    participants: thread.users ? thread.users.map(user => ({
                        id: user.pk,
                        username: user.username,
                        fullName: user.full_name,
                        isPrivate: user.is_private,
                        profilePicUrl: user.profile_pic_url
                    })) : [],
                    lastMessage: {
                        text: thread.last_permanent_item?.text || '',
                        timestamp: safeTimestamp(thread.last_activity_at),
                        sender: thread.last_permanent_item?.user_id || null
                    },
                    unreadCount: thread.unseen_count || 0,
                    isActive: thread.is_active || false,
                    lastActivity: safeTimestamp(thread.last_activity_at)
                };
            });

            console.log(`✅ Encontradas ${formattedConversations.length} conversas para instância ${instanceId}`);
            return formattedConversations;
        } catch (error) {
            console.error(`❌ Erro ao obter conversas da instância ${instanceId}:`, error);
            throw error;
        }
    }

    // Obter mensagens
    async getMessages(instanceId, threadId) {
        try {
            if (!threadId || threadId === 'undefined') {
                throw new Error('Thread ID inválido ou não fornecido');
            }

  
            
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            // Buscar dados da instância no banco para obter credenciais
            const instanceData = await this.database.getInstance(instanceId);
            if (!instanceData) {
                throw new Error('Dados da instância não encontrados');
            }

            if (!instanceData.password) {
                throw new Error('Senha da instância não encontrada. Reconecte a instância.');
            }

            // Criar nova autenticação para esta instância
            const auth = new InstagramAuth();
            const loginResult = await auth.login(instanceData.username, instanceData.password);
            
            if (!loginResult.success) {
                throw new Error(`Falha na autenticação: ${loginResult.message}`);
            }

            // Usar a API do Instagram diretamente
            const igClient = auth.getIgClient();
            
            // Buscar mensagens da thread específica
            const threadFeed = igClient.feed.directThread({ thread_id: threadId });
            const messages = await threadFeed.items();
            
            console.log(`💬 Encontradas ${messages.length} mensagens`);
            
            // Formatar mensagens para o frontend
            const formattedMessages = messages.map(message => {
                // Função para converter timestamp de forma segura
                const safeTimestamp = (timestamp) => {
                    if (!timestamp) return null;
                    try {
                        const date = new Date(timestamp / 1000000); // Instagram usa microssegundos
                        return isNaN(date.getTime()) ? null : date.toISOString();
                    } catch (error) {
                        console.warn('Erro ao converter timestamp:', timestamp, error);
                        return null;
                    }
                };

                const isFromMe = message.user_id === igClient.state.cookieUserId?.toString();

                return {
                    id: message.item_id || message.id,
                    text: message.text || '',
                    timestamp: safeTimestamp(message.timestamp),
                    sender: {
                        id: message.user_id,
                        username: message.username || 'unknown',
                        fullName: message.full_name || 'Unknown User'
                    },
                    type: message.item_type || 'text',
                    isFromMe: isFromMe,
                    threadId: threadId,
                    clientContext: message.client_context || null
                };
            });

            console.log(`✅ Encontradas ${formattedMessages.length} mensagens para thread ${threadId}`);
            return formattedMessages;
        } catch (error) {
            console.error(`❌ Erro ao obter mensagens da instância ${instanceId}:`, error);
            throw error;
        }
    }

    // Obter mensagem por ID (com extração de mídia)
    async getMessageById(instanceId, threadId, messageId) {
        try {
            if (!threadId || !messageId) {
                throw new Error('Thread ID e Message ID são obrigatórios');
            }

            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            const instanceData = await this.database.getInstance(instanceId);
            if (!instanceData || !instanceData.password) {
                throw new Error('Credenciais da instância indisponíveis. Reconecte a instância.');
            }

            const auth = new InstagramAuth();
            const loginResult = await auth.login(instanceData.username, instanceData.password);
            if (!loginResult.success) {
                throw new Error(`Falha na autenticação: ${loginResult.message}`);
            }

            const messaging = new InstagramMessaging(auth.getIgClient());
            const message = await messaging.getMessageById(String(threadId), String(messageId), 5);

            // Normalizar resposta
            return {
                success: true,
                message: {
                    id: message.id,
                    type: message.itemType,
                    text: message.text,
                    timestamp: message.timestamp,
                    userId: message.userId,
                    media: message.media || null
                }
            };
        } catch (error) {
            console.error(`❌ Erro ao obter mensagem ${messageId} da instância ${instanceId}:`, error);
            throw error;
        }
    }
    // Buscar usuário
    async searchUser(instanceId, username) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            // Aqui você implementaria a busca de usuário
            // Por enquanto, retornar dados simulados
            return {
                id: '123456789',
                username: username,
                fullName: 'Usuário Teste',
                profilePicUrl: 'https://via.placeholder.com/150',
                isPrivate: false,
                isVerified: false
            };
        } catch (error) {
            console.error(`❌ Erro ao buscar usuário na instância ${instanceId}:`, error);
            throw error;
        }
    }

    // Obter informações do usuário
    async getUserInfo(instanceId, userId) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            // Aqui você implementaria a busca de informações do usuário
            // Por enquanto, retornar dados simulados
            return {
                id: userId,
                username: 'usuario_teste',
                fullName: 'Usuário Teste',
                biography: 'Biografia do usuário',
                followersCount: 1000,
                followingCount: 500,
                postsCount: 50,
                isPrivate: false,
                isVerified: false,
                profilePicUrl: 'https://via.placeholder.com/150'
            };
        } catch (error) {
            console.error(`❌ Erro ao obter informações do usuário na instância ${instanceId}:`, error);
            throw error;
        }
    }

    // Obter status da instância
    async getInstanceStatus(instanceId) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                return { status: 'not_found' };
            }

            return {
                id: instance.id,
                name: instance.name,
                username: instance.username,
                status: instance.status,
                lastActivity: instance.lastActivity,
                isActive: instance.isActive
            };
        } catch (error) {
            console.error(`❌ Erro ao obter status da instância ${instanceId}:`, error);
            throw error;
        }
    }
}

module.exports = InstanceManager;

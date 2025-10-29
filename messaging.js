class InstagramMessaging {
    constructor(igClient) {
        this.ig = igClient;
    }

    async getDirectMessages(limit = 20) {
        try {
            console.log('Buscando mensagens diretas...');
            const inbox = await this.ig.feed.directInbox().items();
            
            console.log(`\n📨 Encontradas ${inbox.length} conversas:`);
            console.log('='.repeat(50));
            
            inbox.forEach((thread, index) => {
                const participants = thread.users.map(user => user.username).join(', ');
                const lastMessage = thread.last_permanent_item?.text || 'Sem mensagens';
                const timestamp = new Date(thread.last_activity_at * 1000).toLocaleString('pt-BR');
                
                console.log(`\n${index + 1}. Conversa com: ${participants}`);
                console.log(`   Última mensagem: ${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}`);
                console.log(`   Data: ${timestamp}`);
                console.log(`   Thread ID: ${thread.thread_id}`);
            });
            
            return inbox;
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error.message);
            throw error;
        }
    }

    async getMessagesFromThread(threadId, limit = 50) {
        try {
            if (!threadId || threadId === 'undefined') {
                throw new Error('Thread ID inválido ou não fornecido');
            }
            
            console.log(`\n📬 Buscando mensagens da conversa ${threadId}...`);
            const threadFeed = this.ig.feed.directThread(threadId);
            const thread = await threadFeed.items();
            
            console.log(`\n💬 Mensagens da conversa:`);
            console.log('='.repeat(50));
            
            thread.reverse().forEach((message, index) => {
                const isFromMe = message.user_id === this.ig.state.cookieUserId?.toString();
                const sender = isFromMe ? 'Você' : 'Outro';
                const timestamp = new Date(message.timestamp / 1000000).toLocaleString('pt-BR');
                const text = message.text || '[Mídia]';
                
                console.log(`\n${index + 1}. ${sender} (${timestamp}):`);
                console.log(`   ${text}`);
            });
            
            return thread;
        } catch (error) {
            console.error('Erro ao buscar mensagens da conversa:', error.message);
            throw error;
        }
    }

    async sendMessage(recipientUsername, message) {
        try {
            console.log(`\n📤 Enviando mensagem para @${recipientUsername}...`);
            
            // Buscar o usuário
            const user = await this.ig.user.searchExact(recipientUsername);
            if (!user) {
                throw new Error(`Usuário @${recipientUsername} não encontrado`);
            }
            
            // Método 1: Tentar usar entity.directThread
            try {
                const threadEntity = this.ig.entity.directThread([user.pk.toString()]);
                const result = await threadEntity.broadcastText(message);
                console.log(`✅ Mensagem enviada com sucesso para @${recipientUsername}!`);
                return result;
            } catch (method1Error) {
                console.log('Método 1 falhou, tentando método alternativo...');
                
                // Método 2: Tentar usar DirectRepository diretamente
                try {
                    const DirectRepository = this.ig.entity.repository.direct;
                    const result = await DirectRepository.broadcastText({
                        text: message,
                        threadIds: [user.pk.toString()]
                    });
                    console.log(`✅ Mensagem enviada com sucesso (método 2)!`);
                    return result;
                } catch (method2Error) {
                    // Método 3: Tentar criar thread e enviar
                    try {
                        // Buscar threads existentes primeiro
                        const inbox = await this.ig.feed.directInbox().items();
                        const existingThread = inbox.find(t => 
                            t.users && t.users.some(u => u.pk.toString() === user.pk.toString())
                        );
                        
                        if (existingThread && existingThread.thread_id) {
                            const threadEntity = this.ig.entity.directThread([existingThread.thread_id]);
                            const result = await threadEntity.broadcastText(message);
                            console.log(`✅ Mensagem enviada usando thread existente!`);
                            return result;
                        } else {
                            // Criar nova thread
                            const threadEntity = this.ig.entity.directThread([user.pk.toString()]);
                            const result = await threadEntity.broadcastText(message);
                            console.log(`✅ Mensagem enviada criando nova thread!`);
                            return result;
                        }
                    } catch (method3Error) {
                        throw new Error(`Todos os métodos falharam. Erro original: ${method1Error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error.message);
            throw error;
        }
    }

    async sendMessageToThread(threadId, message) {
        try {
            if (!threadId || threadId === 'undefined' || threadId.trim() === '') {
                throw new Error('Thread ID inválido ou não fornecido');
            }
            
            console.log(`\n📤 Enviando mensagem para thread ${threadId}...`);
            
            // Método 1: Tentar usar entity.directThread diretamente
            try {
                const threadEntity = this.ig.entity.directThread([threadId]);
                const result = await threadEntity.broadcastText(message);
                console.log(`✅ Mensagem enviada com sucesso!`);
                return result;
            } catch (method1Error) {
                // Método 2: Tentar buscar participantes do thread e criar nova mensagem
                try {
                    const threadFeed = this.ig.feed.directThread(threadId);
                    const threadData = await threadFeed.items();
                    
                    if (threadData && threadData.length > 0) {
                        const participants = threadData[0].users || [];
                        const userIds = participants.map(u => u.pk.toString());
                        
                        const threadEntity = this.ig.entity.directThread(userIds);
                        const result = await threadEntity.broadcastText(message);
                        console.log(`✅ Mensagem enviada com sucesso (método alternativo)!`);
                        return result;
                    } else {
                        throw new Error('Thread não encontrado ou sem participantes');
                    }
                } catch (method2Error) {
                    throw new Error(`Erro ao enviar mensagem: ${method1Error.message}. Método alternativo também falhou: ${method2Error.message}`);
                }
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error.message);
            throw error;
        }
    }

    async searchUser(username) {
        try {
            console.log(`\n🔍 Buscando usuário @${username}...`);
            const user = await this.ig.user.searchExact(username);
            
            if (user) {
                console.log(`\n👤 Usuário encontrado:`);
                console.log(`   Nome: ${user.full_name}`);
                console.log(`   Username: @${user.username}`);
                console.log(`   Seguidores: ${user.follower_count}`);
                console.log(`   Seguindo: ${user.following_count}`);
                console.log(`   Posts: ${user.media_count}`);
                console.log(`   Privado: ${user.is_private ? 'Sim' : 'Não'}`);
            } else {
                console.log(`❌ Usuário @${username} não encontrado`);
            }
            
            return user;
        } catch (error) {
            console.error('Erro ao buscar usuário:', error.message);
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            const user = await this.ig.account.currentUser();
            console.log(`\n👤 Usuário logado:`);
            console.log(`   Nome: ${user.full_name}`);
            console.log(`   Username: @${user.username}`);
            console.log(`   Seguidores: ${user.follower_count}`);
            console.log(`   Seguindo: ${user.following_count}`);
            console.log(`   Posts: ${user.media_count}`);
            
            return user;
        } catch (error) {
            console.error('Erro ao buscar informações do usuário:', error.message);
            throw error;
        }
    }

    async getCurrentUserInfo() {
        try {
            const user = await this.ig.account.currentUser();
            return {
                full_name: user.full_name,
                username: user.username,
                follower_count: user.follower_count,
                following_count: user.following_count,
                media_count: user.media_count,
                profile_pic_url: user.profile_pic_url
            };
        } catch (error) {
            console.error('Erro ao buscar informações do usuário:', error.message);
            throw error;
        }
    }

    async getDirectMessagesData(limit = 20) {
        try {
            const inbox = await this.ig.feed.directInbox().items();
            
            const conversations = inbox.slice(0, limit).map(thread => {
                const participants = thread.users ? thread.users.map(user => ({
                    username: user.username || user.user_name || 'unknown',
                    full_name: user.full_name || '',
                    profile_pic_url: user.profile_pic_url || user.profile_picture || null
                })) : [];
                
                const lastMessage = thread.last_permanent_item?.text || thread.last_permanent_item?.item_id || 'Sem mensagens';
                const timestamp = new Date((thread.last_activity_at || thread.last_activity_at_ms || Date.now()) * 1000);
                
                // Tentar extrair thread_id de múltiplas possibilidades
                let threadId = null;
                
                // Tentar diferentes formatos de thread_id
                if (thread.thread_id) {
                    threadId = String(thread.thread_id);
                } else if (thread.threadId) {
                    threadId = String(thread.threadId);
                } else if (thread.id) {
                    threadId = String(thread.id);
                } else if (thread.thread_v2_id) {
                    threadId = String(thread.thread_v2_id);
                } else if (thread.thread_key) {
                    threadId = String(thread.thread_key);
                } else if (thread.users && thread.users.length > 0) {
                    // Se não temos thread_id, criar um baseado nos participantes
                    const userIds = thread.users.map(u => u.pk || u.user_id || '').filter(Boolean);
                    if (userIds.length > 0) {
                        threadId = userIds.sort().join('_');
                    }
                }
                
                // Log para debug
                if (!threadId) {
                    console.warn('Thread sem ID válido encontrado. Estrutura:', {
                        has_thread_id: !!thread.thread_id,
                        has_threadId: !!thread.threadId,
                        has_id: !!thread.id,
                        has_users: !!thread.users,
                        keys: Object.keys(thread)
                    });
                }
                
                return {
                    thread_id: threadId,
                    participants: participants,
                    last_message: String(lastMessage).substring(0, 100),
                    timestamp: timestamp,
                    formatted_time: timestamp.toLocaleString('pt-BR')
                };
            }).filter(conv => {
                // Filtrar conversas sem thread_id válido
                const isValid = conv.thread_id && conv.thread_id !== 'null' && conv.thread_id !== 'undefined' && conv.thread_id.trim() !== '';
                if (!isValid) {
                    console.warn('Removendo conversa sem thread_id válido');
                }
                return isValid;
            });
            
            console.log(`📨 Encontradas ${conversations.length} conversas válidas de ${inbox.length} total`);
            
            return conversations;
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error.message);
            throw error;
        }
    }

    async getMessagesFromThreadData(threadId, limit = 50) {
        try {
            if (!threadId || threadId === 'undefined' || threadId === 'null' || threadId.trim() === '') {
                throw new Error('Thread ID inválido ou não fornecido');
            }
            
            console.log(`Tentando buscar mensagens com threadId: ${threadId} (tipo: ${typeof threadId})`);
            
            // Método 1: Buscar o thread completo do inbox primeiro
            try {
                console.log('Método 1: Buscando thread do inbox...');
                const inbox = await this.ig.feed.directInbox().items();
                
                // Tentar encontrar o thread no inbox pelo thread_id
                let foundThread = inbox.find(t => {
                    const tId = String(t.thread_id || t.threadId || t.id || '');
                    return tId === String(threadId);
                });
                
                // Se não encontrou pelo thread_id, tentar pelos participantes (se threadId tem underscore)
                if (!foundThread && threadId.includes('_')) {
                    console.log('Thread não encontrado pelo ID, tentando pelos participantes...');
                    foundThread = inbox.find(t => {
                        if (!t.users) return false;
                        const tUserIds = t.users.map(u => String(u.pk || u.user_id || '')).filter(Boolean).sort();
                        return tUserIds.join('_') === threadId;
                    });
                }
                
                if (foundThread) {
                    // Usar o thread_id real do objeto encontrado
                    const realThreadId = foundThread.thread_id || foundThread.threadId || foundThread.id;
                    console.log(`Thread encontrado! Usando thread_id: ${realThreadId}`);
                    
                    // Tentar buscar mensagens usando o thread_id real
                    try {
                        const threadFeed = this.ig.feed.directThread(String(realThreadId));
                        const thread = await threadFeed.items();
                        
                        if (thread && thread.length > 0) {
                            return this.formatMessages(thread.slice(0, limit));
                        }
                    } catch (feedError) {
                        console.log('Erro ao buscar do feed, tentando extrair do próprio thread...', feedError.message);
                        
                        // Método alternativo: tentar extrair mensagens do objeto do thread
                        if (foundThread.items && foundThread.items.length > 0) {
                            return this.formatMessages(foundThread.items.slice(0, limit));
                        }
                        
                        // Se o thread tem thread_v2_id, tentar usar isso
                        if (foundThread.thread_v2_id) {
                            try {
                                const threadFeed = this.ig.feed.directThread(String(foundThread.thread_v2_id));
                                const thread = await threadFeed.items();
                                if (thread && thread.length > 0) {
                                    return this.formatMessages(thread.slice(0, limit));
                                }
                            } catch (v2Error) {
                                console.log('thread_v2_id também falhou:', v2Error.message);
                            }
                        }
                    }
                }
            } catch (error1) {
                console.log('Método 1 falhou:', error1.message);
            }
            
            // Método 2: Tentar diretamente com o threadId fornecido
            try {
                console.log('Método 2: Tentando usar threadId diretamente...');
                const threadIdStr = String(threadId).trim();
                const threadFeed = this.ig.feed.directThread(threadIdStr);
                const thread = await threadFeed.items();
                
                if (thread && thread.length > 0) {
                    return this.formatMessages(thread.slice(0, limit));
                }
            } catch (error2) {
                console.log('Método 2 falhou:', error2.message);
                
                // Método 3: Tentar converter para número se for possível
                if (!isNaN(threadId)) {
                    try {
                        console.log('Método 3: Tentando como número...');
                        const threadFeed = this.ig.feed.directThread(Number(threadId));
                        const thread = await threadFeed.items();
                        
                        if (thread && thread.length > 0) {
                            return this.formatMessages(thread.slice(0, limit));
                        }
                    } catch (error3) {
                        console.log('Método 3 falhou:', error3.message);
                    }
                }
            }
            
            // Se chegou aqui, todos os métodos falharam
            throw new Error(`Não foi possível carregar mensagens do thread ${threadId}. O thread pode não existir ou não ter mensagens.`);
            
        } catch (error) {
            console.error('Erro ao buscar mensagens da conversa:', error.message);
            throw error;
        }
    }
    
    formatMessages(threadItems) {
        const currentUserId = String(this.ig.state.cookieUserId || this.ig.state.cookieUserId?.toString() || '');
        
        return threadItems.reverse().map(message => {
            const userId = String(message.user_id || message.userId || message.user?.pk || '');
            const isFromMe = userId === currentUserId;
            
            // Tentar diferentes formatos de timestamp
            let timestamp = new Date();
            if (message.timestamp) {
                const ts = Number(message.timestamp);
                if (ts > 10000000000000) {
                    // Microssegundos
                    timestamp = new Date(ts / 1000);
                } else if (ts > 1000000000000) {
                    // Milissegundos
                    timestamp = new Date(ts);
                } else if (ts > 0) {
                    // Segundos
                    timestamp = new Date(ts * 1000);
                }
            } else if (message.taken_at) {
                timestamp = new Date(Number(message.taken_at) * 1000);
            }
            
            return {
                text: message.text || message.item_type || '[Mídia]',
                is_from_me: isFromMe,
                timestamp: timestamp,
                formatted_time: timestamp.toLocaleString('pt-BR'),
                user_id: userId
            };
        });
    }
}

module.exports = InstagramMessaging;

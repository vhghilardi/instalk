function pickFirstUrl(list) {
    if (!Array.isArray(list)) return null;
    const candidate = list.find(item => item?.url) || list[0];
    return candidate?.url || null;
}

function extractMediaFromMessage(message) {
    try {
        if (!message) return null;
        const type = message.item_type;

        if (type === 'media' && message.media) {
            const media = message.media;
            const images = media.image_versions2?.candidates?.map(c => c.url).filter(Boolean) || [];
            const videos = media.video_versions?.map(v => v.url).filter(Boolean) || [];
            return {
                type: media.video_versions ? 'video' : 'image',
                url: media.video_versions ? pickFirstUrl(media.video_versions) : pickFirstUrl(media.image_versions2?.candidates),
                images,
                videos,
                preview: media.thumbnail_url || media.preview || null
            };
        }

        if (type === 'raven_media' || type === 'visual_media') {
            const rm = message.raven_media || message.visual_media || null;
            const container = rm?.media || rm?.visual_media || rm || null;
            const imageCandidates = container?.image_versions2?.candidates
                || container?.images?.map?.(img => ({ url: img }))
                || [];
            const videoCandidates = container?.video_versions
                || container?.videos
                || container?.dash_manifest?.videos
                || [];
            const images = Array.isArray(imageCandidates) ? imageCandidates.map(c => c?.url).filter(Boolean) : [];
            const videos = Array.isArray(videoCandidates) ? videoCandidates.map(v => v?.url || v?.src).filter(Boolean) : [];
            const expiresAtSeconds = rm?.expiring_at || container?.expiring_at || container?.expiry || null;
            const playbackUrl = container?.playback_url
                || container?.direct_viewer_url
                || container?.video_dash_manifest
                || container?.streaming_url
                || container?.url
                || null;
            return {
                type: videos.length ? 'video_ephemeral' : 'image_ephemeral',
                url: videos.length ? pickFirstUrl(videoCandidates) || playbackUrl : pickFirstUrl(imageCandidates) || playbackUrl,
                expiresAt: expiresAtSeconds ? new Date(Number(expiresAtSeconds) * 1000).toISOString() : null,
                images,
                videos,
                preview: container?.thumbnail_url || container?.preview || container?.cover_frame_url || null
            };
        }

        if (type === 'animated_media' && message.animated_media?.images) {
            const images = Object.values(message.animated_media.images)
                .map(x => x?.url)
                .filter(Boolean);
            return {
                type: 'animated',
                url: pickFirstUrl(Object.values(message.animated_media.images)),
                images,
                videos: []
            };
        }

        if (type === 'link' && message.link) {
            return { type: 'link', url: message.link.link_context?.link_url || message.link.text || null };
        }

        if (type === 'voice_media' && message.voice_media) {
            const voiceMedia = message.voice_media;
            const media = voiceMedia.media || voiceMedia;
            const audio = media.audio || voiceMedia.audio || null;

            const url = audio?.audio_src
                || audio?.audio
                || audio?.audio_url
                || audio?.url
                || media.audio_src
                || media.url
                || media.playback_url
                || null;

            const durationMs = typeof audio?.duration_ms === 'number' ? audio.duration_ms
                : typeof audio?.duration_in_ms === 'number' ? audio.duration_in_ms
                : typeof audio?.duration === 'number' ? Math.round(audio.duration * 1000)
                : typeof voiceMedia.duration_ms === 'number' ? voiceMedia.duration_ms
                : typeof voiceMedia.duration === 'number' ? Math.round(voiceMedia.duration * 1000)
                : null;

            const durationSeconds = durationMs != null ? durationMs / 1000
                : typeof audio?.duration === 'number' ? audio.duration
                : typeof voiceMedia.duration === 'number' ? voiceMedia.duration
                : null;

            const waveform = Array.isArray(audio?.waveform) ? audio.waveform
                : Array.isArray(voiceMedia.waveform) ? voiceMedia.waveform
                : Array.isArray(media.waveform) ? media.waveform
                : null;

            const codec = audio?.codec || media.codec || null;
            const samplingRate = audio?.sampling_rate || audio?.samplingFrequency || null;

            return {
                type: 'voice',
                url,
                durationMs,
                durationSeconds,
                waveform,
                codec,
                samplingRate,
                preview: media.waveform_visualization || null
            };
        }

        return null;
    } catch (_) {
        return null;
    }
}

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
            console.log(`\n🔍 getMessagesFromThread chamado com threadId: ${threadId}, tipo: ${typeof threadId}`);
            
            if (!threadId || threadId === 'undefined') {
                throw new Error('Thread ID inválido ou não fornecido');
            }
            
            console.log(`\n📬 Buscando mensagens da conversa ${threadId}...`);
            
            // Usar o método correto da biblioteca
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

    async getMessageById(threadId, messageId, maxPages = 5) {
        if (!threadId || !messageId) {
            throw new Error('Thread ID e Message ID são obrigatórios');
        }

        const idStr = String(threadId).trim();
        const msgIdStr = String(messageId).trim();

        // Tenta com o formato que funcionou para listar mensagens ({ thread_id })
        const tryFindInFeed = async (feed) => {
            let page = 0;
            while (page < maxPages) {
                const items = await feed.items();
                const found = items.find(it => String(it.item_id || it.id) === msgIdStr);
                if (found) return this.formatSingleMessage(found);
                if (typeof feed.isMoreAvailable === 'function' && !feed.isMoreAvailable()) break;
                page += 1;
            }
            return null;
        };

        // Tentativa 1: objeto com thread_id
        try {
            const feedObj = this.ig.feed.directThread({ thread_id: idStr });
            const result = await tryFindInFeed(feedObj);
            if (result) return result;
        } catch (e1) {
            // continua para fallback
        }

        // Tentativa 2: string direta
        try {
            const feedStr = this.ig.feed.directThread(idStr);
            const result = await tryFindInFeed(feedStr);
            if (result) return result;
        } catch (e2) {
            // continua para fallback
        }

        // Tentativa 3: resolver thread real pelo inbox e usar seu thread_id
        try {
            const inbox = await this.ig.feed.directInbox().items();
            const foundThread = inbox.find(t => String(t.thread_id || t.id || '') === idStr);
            if (foundThread && foundThread.thread_id) {
                const feedReal = this.ig.feed.directThread({ thread_id: String(foundThread.thread_id) });
                const result = await tryFindInFeed(feedReal);
                if (result) return result;
            }
        } catch (e3) {
            // ignora
        }

        throw new Error('Mensagem não encontrada neste thread');
    }

    formatSingleMessage(message) {
        // Extrair mídia quando aplicável
        const media = extractMediaFromMessage(message);
        const tsNum = Number(message.timestamp || message.taken_at || 0);
        const ts = tsNum > 10000000000000 ? new Date(tsNum / 1000) : tsNum > 1000000000000 ? new Date(tsNum) : tsNum > 0 ? new Date(tsNum * 1000) : null;
        return {
            id: String(message.item_id || message.id),
            itemType: message.item_type || 'unknown',
            text: message.text || null,
            timestamp: ts ? ts.toISOString() : null,
            userId: message.user_id || null,
            media
        };
    }

    extractMediaFromMessage(message) {
        return extractMediaFromMessage(message);
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
            // Garantir que username é uma string
            if (!username || typeof username !== 'string') {
                console.error(`❌ Username inválido:`, username, typeof username);
                return { success: false, message: 'Username deve ser uma string' };
            }
            
            const cleanUsername = username.replace('@', '').trim();
            console.log(`\n🔍 Buscando usuário @${cleanUsername}...`);
            const user = await this.ig.user.searchExact(cleanUsername);
            
            if (user) {
                console.log(`\n👤 Usuário encontrado:`);
                console.log(`   Nome: ${user.full_name}`);
                console.log(`   Username: @${user.username}`);
                console.log(`   Seguidores: ${user.follower_count}`);
                console.log(`   Seguindo: ${user.following_count}`);
                console.log(`   Posts: ${user.media_count}`);
                console.log(`   Privado: ${user.is_private ? 'Sim' : 'Não'}`);
                console.log(`   ID/PK: ${user.pk || user.id}`);
                
                return { success: true, user: user };
            } else {
                console.log(`❌ Usuário @${username} não encontrado`);
                return { success: false, message: `Usuário @${username} não encontrado` };
            }
        } catch (error) {
            console.error('Erro ao buscar usuário:', error.message);
            return { success: false, message: error.message };
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

            const media = extractMediaFromMessage(message);
            let text = message.text;
            if (!text) {
                if (media) {
                    if (media.type === 'voice') {
                        text = '[Mensagem de áudio]';
                    } else if (media.type) {
                        text = `[${media.type}]`;
                    }
                }
            }
            if (!text) {
                text = message.item_type || '[Mídia]';
            }

            return {
                text,
                is_from_me: isFromMe,
                timestamp: timestamp,
                formatted_time: timestamp.toLocaleString('pt-BR'),
                user_id: userId,
                media
            };
        });
    }
}

module.exports = InstagramMessaging;
InstagramMessaging.extractMediaFromMessage = extractMediaFromMessage;

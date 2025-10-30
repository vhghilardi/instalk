const { v4: uuidv4 } = require('uuid');
const InstagramAuth = require('./auth');
const InstagramMessaging = require('./messaging');

class InstanceManager {
    constructor(database) {
        this.database = database;
        this.instances = new Map(); // Cache de instâncias ativas
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
            const instanceId = uuidv4();
            
            // Criar no banco de dados
            await this.database.createInstance(instanceId, name, username);
            
            // Tentar conectar automaticamente
            const connectResult = await this.connectInstance(instanceId, password);
            
            const instance = {
                id: instanceId,
                name: name,
                username: username,
                status: connectResult.success ? 'connected' : 'disconnected',
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                isActive: true,
                metadata: {}
            };

            // Adicionar ao cache
            this.instances.set(instanceId, instance);
            
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
                
                // Atualizar status no banco
                await this.database.updateInstanceStatus(instanceId, 'connected');
                
                // Atualizar cache
                instance.status = 'connected';
                instance.lastActivity = new Date().toISOString();
                this.instances.set(instanceId, instance);
                
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

            // Aqui você implementaria o envio de mensagem
            // Por enquanto, retornar sucesso simulado
            console.log(`📤 Mensagem enviada via ${instance.name}: ${recipient} - ${message}`);
            return { success: true, message: 'Mensagem enviada com sucesso' };
        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem via ${instanceId}:`, error);
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

            // Aqui você implementaria a busca de conversas
            // Por enquanto, retornar array vazio
            return [];
        } catch (error) {
            console.error(`❌ Erro ao obter conversas da instância ${instanceId}:`, error);
            throw error;
        }
    }

    // Obter mensagens
    async getMessages(instanceId, threadId) {
        try {
            const instance = await this.getInstance(instanceId);
            if (!instance) {
                throw new Error('Instância não encontrada');
            }

            if (instance.status !== 'connected') {
                throw new Error('Instância não está conectada');
            }

            // Aqui você implementaria a busca de mensagens
            // Por enquanto, retornar array vazio
            return [];
        } catch (error) {
            console.error(`❌ Erro ao obter mensagens da instância ${instanceId}:`, error);
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

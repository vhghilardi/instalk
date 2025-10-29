require('dotenv').config();
const readlineSync = require('readline-sync');
const InstagramAuth = require('./auth');
const InstagramMessaging = require('./messaging');

class InstagramApp {
    constructor() {
        this.auth = new InstagramAuth();
        this.messaging = null;
        this.isLoggedIn = false;
    }

    async start() {
        console.log('🚀 Instagram Messaging App');
        console.log('='.repeat(40));
        
        await this.login();
        
        if (this.isLoggedIn) {
            this.messaging = new InstagramMessaging(this.auth.getIgClient());
            await this.showMainMenu();
        }
    }

    async login() {
        console.log('\n🔐 Login no Instagram');
        console.log('-'.repeat(20));
        
        // Tentar usar credenciais do .env primeiro
        let username = process.env.INSTAGRAM_USERNAME;
        let password = process.env.INSTAGRAM_PASSWORD;
        
        if (!username || !password) {
            console.log('⚠️  Credenciais não encontradas no arquivo .env');
            console.log('📝 Por favor, configure suas credenciais:');
            username = readlineSync.question('Username: ');
            password = readlineSync.question('Password: ', { hideEchoBack: true });
        } else {
            console.log(`📱 Usando credenciais do arquivo .env para: ${username}`);
        }
        
        const loginResult = await this.auth.login(username, password);
        
        if (!loginResult.success) {
            console.log('❌ Falha no login:');
            console.log('   ' + loginResult.message);
            
            if (loginResult.error === 'challenge_required') {
                console.log('\n🔧 Soluções:');
                console.log('   1. Faça login no app oficial do Instagram');
                console.log('   2. Complete qualquer verificação solicitada');
                console.log('   3. Aguarde 10-15 minutos');
                console.log('   4. Tente novamente');
            }
            
            process.exit(1);
        }
        
        this.isLoggedIn = true;
    }

    async showMainMenu() {
        while (true) {
            console.log('\n📱 Menu Principal');
            console.log('='.repeat(20));
            console.log('1. Ver minhas informações');
            console.log('2. Buscar usuário');
            console.log('3. Ver conversas');
            console.log('4. Ler mensagens de uma conversa');
            console.log('5. Enviar mensagem para usuário');
            console.log('6. Enviar mensagem para conversa');
            console.log('7. Logout');
            console.log('0. Sair');
            
            const choice = readlineSync.question('\nEscolha uma opção: ');
            
            try {
                switch (choice) {
                    case '1':
                        await this.showCurrentUser();
                        break;
                    case '2':
                        await this.searchUser();
                        break;
                    case '3':
                        await this.showConversations();
                        break;
                    case '4':
                        await this.readThreadMessages();
                        break;
                    case '5':
                        await this.sendMessageToUser();
                        break;
                    case '6':
                        await this.sendMessageToThread();
                        break;
                    case '7':
                        await this.logout();
                        return;
                    case '0':
                        console.log('👋 Até logo!');
                        process.exit(0);
                    default:
                        console.log('❌ Opção inválida!');
                }
            } catch (error) {
                console.error('❌ Erro:', error.message);
            }
            
            readlineSync.question('\nPressione Enter para continuar...');
        }
    }

    async showCurrentUser() {
        await this.messaging.getCurrentUser();
    }

    async searchUser() {
        const username = readlineSync.question('Digite o username (sem @): ');
        await this.messaging.searchUser(username);
    }

    async showConversations() {
        const limit = readlineSync.question('Quantas conversas mostrar? (padrão: 20): ') || '20';
        await this.messaging.getDirectMessages(parseInt(limit));
    }

    async readThreadMessages() {
        const threadId = readlineSync.question('Digite o Thread ID: ');
        const limit = readlineSync.question('Quantas mensagens mostrar? (padrão: 50): ') || '50';
        await this.messaging.getMessagesFromThread(threadId, parseInt(limit));
    }

    async sendMessageToUser() {
        const username = readlineSync.question('Digite o username (sem @): ');
        const message = readlineSync.question('Digite a mensagem: ');
        
        if (!message.trim()) {
            console.log('❌ Mensagem não pode estar vazia!');
            return;
        }
        
        await this.messaging.sendMessage(username, message);
    }

    async sendMessageToThread() {
        const threadId = readlineSync.question('Digite o Thread ID: ');
        const message = readlineSync.question('Digite a mensagem: ');
        
        if (!message.trim()) {
            console.log('❌ Mensagem não pode estar vazia!');
            return;
        }
        
        await this.messaging.sendMessageToThread(threadId, message);
    }

    async logout() {
        await this.auth.logout();
        console.log('👋 Logout realizado!');
    }
}

// Iniciar a aplicação
const app = new InstagramApp();
app.start().catch(error => {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
});
